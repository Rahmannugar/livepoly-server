import { Injectable } from '@nestjs/common';
import { getGameBoard } from '../engine/game-board';
import {
  getCurrentAuctionBidderRoomPlayerId,
  getMinimumAuctionBid,
} from '../engine/game-engine-auctions';
import type {
  AirportTile,
  GameTile,
  PropertySetKey,
  PropertyTile,
  UtilityTile,
} from '../engine/game-board.types';
import type { GameEngineIntent } from '../engine/game-engine-intents';
import type {
  BotDifficulty,
  DiceRoll,
  GameEnginePlayer,
  GameEngineProperty,
  GameEngineState,
} from '../engine/game-engine.types';
import { GAME_BOTS } from '../game.constants';
import type { BotDecision } from './game-bot.types';

type OwnableTile = PropertyTile | AirportTile | UtilityTile;

@Injectable()
export class GameBotService {
  chooseDecision(state: GameEngineState): BotDecision | null {
    const bot = this.findActionBot(state);

    if (!bot) {
      return null;
    }

    const intent = this.chooseIntentForBot(state, bot);

    if (!intent) {
      return null;
    }

    return {
      roomPlayerId: bot.roomPlayerId,
      intent,
    };
  }

  hasActionableBot(state: GameEngineState): boolean {
    return this.chooseDecision(state) !== null;
  }

  private chooseIntentForBot(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): GameEngineIntent | null {
    if (
      state.phase === 'awaiting_first_turn' ||
      state.phase === 'awaiting_roll'
    ) {
      if (bot.inJail && this.shouldPayJailFine(bot)) {
        return {
          type: 'pay_jail_fine',
          payload: { roomPlayerId: bot.roomPlayerId },
        };
      }

      return {
        type: 'roll_and_move',
        payload: {
          roomPlayerId: bot.roomPlayerId,
          dice: this.rollDice(),
        },
      };
    }

    if (state.phase === 'awaiting_property_decision') {
      return this.choosePropertyDecision(state, bot);
    }

    if (state.phase === 'awaiting_auction_bid') {
      return this.chooseAuctionDecision(state, bot);
    }

    if (state.phase === 'awaiting_debt_resolution') {
      return this.chooseDebtDecision(state, bot);
    }

    if (state.phase === 'awaiting_turn_end') {
      if (state.tradeOffer) {
        return this.chooseTradeResponseDecision(state, bot);
      }

      const unmortgageTileKey = this.findPropertyToUnmortgage(state, bot);

      if (unmortgageTileKey) {
        return {
          type: 'unmortgage_property',
          payload: {
            roomPlayerId: bot.roomPlayerId,
            tileKey: unmortgageTileKey,
          },
        };
      }

      const buildTileKey = this.findPropertyToBuild(state, bot);

      if (buildTileKey) {
        return {
          type: 'build_property',
          payload: {
            roomPlayerId: bot.roomPlayerId,
            tileKey: buildTileKey,
          },
        };
      }

      const tradeIntent = this.chooseTradeProposal(state, bot);

      if (tradeIntent) {
        return tradeIntent;
      }

      return {
        type: 'end_turn',
        payload: { roomPlayerId: bot.roomPlayerId },
      };
    }

    return null;
  }

  private findActionBot(state: GameEngineState): GameEnginePlayer | null {
    if (state.phase === 'finished' || state.phase === 'cancelled') {
      return null;
    }

    if (state.phase === 'awaiting_auction_bid' && state.auction) {
      const botRoomPlayerId = getCurrentAuctionBidderRoomPlayerId(
        state.auction,
      );
      const bot = botRoomPlayerId
        ? this.findPlayer(state, botRoomPlayerId)
        : null;

      return bot?.playerType === 'bot' ? bot : null;
    }

    const currentPlayer = this.findPlayer(state, state.currentTurnRoomPlayerId);

    if (!currentPlayer || currentPlayer.playerType !== 'bot') {
      return null;
    }

    return currentPlayer.bankrupt ? null : currentPlayer;
  }

  private choosePropertyDecision(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): GameEngineIntent {
    const tile = this.getPendingOwnableTile(state);

    if (!tile || !this.shouldBuyTile(state, bot, tile)) {
      return {
        type: 'decline_property_purchase',
        payload: { roomPlayerId: bot.roomPlayerId },
      };
    }

    return {
      type: 'buy_property',
      payload: { roomPlayerId: bot.roomPlayerId },
    };
  }

  private chooseAuctionDecision(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): GameEngineIntent | null {
    const auction = state.auction;

    if (!auction || auction.passedRoomPlayerIds.includes(bot.roomPlayerId)) {
      return null;
    }

    const tile = this.getOwnableTile(state, auction.tileKey);

    if (!tile) {
      return {
        type: 'pass_auction_bid',
        payload: { roomPlayerId: bot.roomPlayerId },
      };
    }

    const maxBid = this.getMaxAuctionBid(bot, tile);
    const nextBid = getMinimumAuctionBid(auction);

    if (nextBid > maxBid || nextBid > bot.cash - this.cashReserve(bot)) {
      return {
        type: 'pass_auction_bid',
        payload: { roomPlayerId: bot.roomPlayerId },
      };
    }

    const bidAmount = this.getAuctionBidAmount(bot, tile, nextBid, maxBid);

    return {
      type: 'place_auction_bid',
      payload: {
        roomPlayerId: bot.roomPlayerId,
        amount: bidAmount,
      },
    };
  }

  private chooseDebtDecision(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): GameEngineIntent | null {
    if (!state.debt || state.debt.roomPlayerId !== bot.roomPlayerId) {
      return null;
    }

    return {
      type: 'auto_resolve_debt',
      payload: {
        roomPlayerId: bot.roomPlayerId,
      },
    };
  }

  private shouldBuyTile(
    state: GameEngineState,
    bot: GameEnginePlayer,
    tile: OwnableTile,
  ): boolean {
    if (tile.price > bot.cash) {
      return false;
    }

    const difficulty = this.difficulty(bot);
    const score = this.scoreTilePurchase(state, bot, tile);

    return score >= GAME_BOTS.buyScoreThreshold[difficulty];
  }

  private scoreTilePurchase(
    state: GameEngineState,
    bot: GameEnginePlayer,
    tile: OwnableTile,
  ): number {
    const difficulty = this.difficulty(bot);
    const remainingCash = bot.cash - tile.price;
    const reserve = this.cashReserve(bot);
    const reservePenalty =
      remainingCash < reserve ? (reserve - remainingCash) / 10 : 0;

    let score =
      this.rentPotentialScore(tile) *
        GAME_BOTS.rentPotentialWeight[difficulty] -
      reservePenalty;

    if (tile.kind === 'property' && tile.price <= 160) {
      score += GAME_BOTS.cheapPropertyBias[difficulty];
    }

    if (tile.kind === 'property' && this.wouldCompleteSet(state, bot, tile)) {
      score += GAME_BOTS.setCompletionBonus[difficulty];
    }

    if (
      tile.kind === 'property' &&
      this.wouldBlockOpponentSet(state, bot, tile)
    ) {
      score += GAME_BOTS.opponentBlockBonus[difficulty];
    }

    return score;
  }

  private chooseTradeResponseDecision(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): GameEngineIntent | null {
    if (
      !state.tradeOffer ||
      state.tradeOffer.toRoomPlayerId !== bot.roomPlayerId
    ) {
      return null;
    }

    return {
      type: this.shouldAcceptTrade(state, bot)
        ? 'accept_trade'
        : 'reject_trade',
      payload: {
        roomPlayerId: bot.roomPlayerId,
        tradeId: state.tradeOffer.id,
      },
    };
  }

  private findPropertyToUnmortgage(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): string | null {
    const board = getGameBoard(state.boardKey);
    const candidates = state.properties
      .filter(
        (property) =>
          property.ownerRoomPlayerId === bot.roomPlayerId && property.mortgaged,
      )
      .map((property) => {
        const tile = this.getOwnableTile(state, property.tileKey);

        return tile
          ? {
              tileKey: property.tileKey,
              cost: this.getUnmortgageCost(tile.mortgageValue),
              score:
                this.rentPotentialScore(tile) +
                (tile.kind === 'property' &&
                this.ownsCompletePropertySet(
                  state,
                  board,
                  bot.roomPlayerId,
                  tile.setKey,
                )
                  ? GAME_BOTS.setCompletionBonus[this.difficulty(bot)]
                  : 0),
            }
          : null;
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .filter((candidate) => bot.cash - candidate.cost >= this.cashReserve(bot))
      .sort((left, right) => right.score - left.score);

    return candidates[0]?.tileKey ?? null;
  }

  private findPropertyToBuild(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): string | null {
    const board = getGameBoard(state.boardKey);
    const maxDevelopmentLevel =
      GAME_BOTS.maxDevelopmentLevel[this.difficulty(bot)];
    const setKeys = new Set<PropertySetKey>();

    for (const tile of board.tiles) {
      if (tile.kind === 'property') {
        setKeys.add(tile.setKey);
      }
    }

    const candidates: Array<{
      tileKey: string;
      cost: number;
      score: number;
      level: number;
    }> = [];

    for (const setKey of setKeys) {
      const setTiles = this.getPropertySetTiles(board, setKey);
      const setProperties = setTiles.map((tile) =>
        this.findPropertyState(state, tile.key),
      );

      if (
        setProperties.some(
          (property) =>
            property.ownerRoomPlayerId !== bot.roomPlayerId ||
            property.mortgaged,
        )
      ) {
        continue;
      }

      const lowestLevel = Math.min(
        ...setProperties.map((property) => this.getDevelopmentLevel(property)),
      );

      if (lowestLevel >= maxDevelopmentLevel) {
        continue;
      }

      for (const tile of setTiles) {
        const property = this.findPropertyState(state, tile.key);
        const level = this.getDevelopmentLevel(property);

        if (level !== lowestLevel || level >= maxDevelopmentLevel) {
          continue;
        }

        if (bot.cash - tile.houseCost < this.cashReserve(bot)) {
          continue;
        }

        candidates.push({
          tileKey: tile.key,
          cost: tile.houseCost,
          level,
          score: this.rentPotentialScore(tile),
        });
      }
    }

    candidates.sort(
      (left, right) => left.level - right.level || right.score - left.score,
    );

    return candidates[0]?.tileKey ?? null;
  }

  private chooseTradeProposal(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): GameEngineIntent | null {
    if (bot.lastBotTradeProposalTurnNumber === state.turnNumber) {
      return null;
    }

    const board = getGameBoard(state.boardKey);
    const candidates = this.findSetCompletingTradeCandidates(state, bot, board);
    const candidate = candidates[0];

    if (!candidate) {
      return null;
    }

    return {
      type: 'propose_trade',
      payload: {
        roomPlayerId: bot.roomPlayerId,
        toRoomPlayerId: candidate.toRoomPlayerId,
        offeredCash: candidate.offeredCash,
        requestedCash: 0,
        offeredPropertyKeys: [],
        requestedPropertyKeys: [candidate.tileKey],
      },
    };
  }

  private findSetCompletingTradeCandidates(
    state: GameEngineState,
    bot: GameEnginePlayer,
    board = getGameBoard(state.boardKey),
  ): Array<{
    tileKey: string;
    toRoomPlayerId: string;
    offeredCash: number;
    score: number;
  }> {
    const setKeys = new Set<PropertySetKey>();

    for (const tile of board.tiles) {
      if (tile.kind === 'property') {
        setKeys.add(tile.setKey);
      }
    }

    const candidates: Array<{
      tileKey: string;
      toRoomPlayerId: string;
      offeredCash: number;
      score: number;
    }> = [];

    for (const setKey of setKeys) {
      const setTiles = this.getPropertySetTiles(board, setKey);
      const ownedByBot = setTiles.filter((tile) => {
        const property = this.findPropertyState(state, tile.key);

        return property.ownerRoomPlayerId === bot.roomPlayerId;
      });

      if (ownedByBot.length !== setTiles.length - 1) {
        continue;
      }

      const missingTile = setTiles.find((tile) => {
        const property = this.findPropertyState(state, tile.key);

        return property.ownerRoomPlayerId !== bot.roomPlayerId;
      });

      if (!missingTile) {
        continue;
      }

      const missingProperty = this.findPropertyState(state, missingTile.key);
      const target = missingProperty.ownerRoomPlayerId
        ? this.findPlayer(state, missingProperty.ownerRoomPlayerId)
        : null;

      if (
        !target ||
        target.bankrupt ||
        missingProperty.mortgaged ||
        missingProperty.houseCount > 0 ||
        missingProperty.hasHotel
      ) {
        continue;
      }

      const offerRatio = Math.max(
        GAME_BOTS.tradeOfferPriceRatio[this.difficulty(bot)],
        target.playerType === 'bot'
          ? GAME_BOTS.tradeAcceptanceMargin[this.difficulty(target)]
          : 1,
      );
      const offeredCash = Math.ceil(missingTile.price * offerRatio);

      if (bot.cash - offeredCash < this.cashReserve(bot)) {
        continue;
      }

      candidates.push({
        tileKey: missingTile.key,
        toRoomPlayerId: target.roomPlayerId,
        offeredCash,
        score:
          this.rentPotentialScore(missingTile) +
          GAME_BOTS.setCompletionBonus[this.difficulty(bot)],
      });
    }

    return candidates.sort((left, right) => right.score - left.score);
  }

  private shouldAcceptTrade(
    state: GameEngineState,
    bot: GameEnginePlayer,
  ): boolean {
    const trade = state.tradeOffer;

    if (!trade) {
      return false;
    }

    const botReceives = this.getTradeValue(state, {
      cash: trade.offeredCash,
      propertyKeys: trade.offeredPropertyKeys,
    });
    const botGives = this.getTradeValue(state, {
      cash: trade.requestedCash,
      propertyKeys: trade.requestedPropertyKeys,
    });

    return (
      botReceives >=
      botGives * GAME_BOTS.tradeAcceptanceMargin[this.difficulty(bot)]
    );
  }

  private shouldPayJailFine(bot: GameEnginePlayer): boolean {
    if (bot.cash < 50) {
      return false;
    }

    return bot.botDifficulty === 'hard' || bot.jailTurnCount >= 2;
  }

  private getMaxAuctionBid(bot: GameEnginePlayer, tile: OwnableTile): number {
    const difficulty = this.difficulty(bot);
    const strategicPremium =
      tile.kind === 'property' ? this.rentPotentialScore(tile) / 2 : 0;

    return Math.floor(
      tile.price * GAME_BOTS.auctionMaxPriceRatio[difficulty] +
        strategicPremium * GAME_BOTS.rentPotentialWeight[difficulty],
    );
  }

  private getAuctionBidAmount(
    bot: GameEnginePlayer,
    tile: OwnableTile,
    minimumBid: number,
    maxBid: number,
  ): number {
    const affordableMax = bot.cash - this.cashReserve(bot);
    const cappedMaxBid = Math.min(maxBid, affordableMax);
    const bidRoom = cappedMaxBid - minimumBid;

    if (bidRoom <= 0) {
      return minimumBid;
    }

    const difficulty = this.difficulty(bot);
    const tileStep = Math.max(
      1,
      Math.floor(tile.price * GAME_BOTS.auctionBidStepRatio[difficulty]),
    );
    const pressureStep =
      difficulty === 'hard' && tile.kind === 'property'
        ? Math.floor(this.rentPotentialScore(tile))
        : 0;

    return minimumBid + Math.min(bidRoom, tileStep + pressureStep);
  }

  private cashReserve(bot: GameEnginePlayer): number {
    return GAME_BOTS.cashReserve[this.difficulty(bot)];
  }

  private difficulty(bot: GameEnginePlayer): BotDifficulty {
    return bot.botDifficulty ?? 'normal';
  }

  private wouldCompleteSet(
    state: GameEngineState,
    bot: GameEnginePlayer,
    tile: PropertyTile,
  ): boolean {
    const board = getGameBoard(state.boardKey);
    const setTiles = board.tiles.filter(
      (candidate): candidate is PropertyTile =>
        candidate.kind === 'property' && candidate.setKey === tile.setKey,
    );

    return setTiles.every((setTile) => {
      if (setTile.key === tile.key) {
        return true;
      }

      return state.properties.some(
        (property) =>
          property.tileKey === setTile.key &&
          property.ownerRoomPlayerId === bot.roomPlayerId,
      );
    });
  }

  private wouldBlockOpponentSet(
    state: GameEngineState,
    bot: GameEnginePlayer,
    tile: PropertyTile,
  ): boolean {
    const board = getGameBoard(state.boardKey);
    const setTiles = board.tiles.filter(
      (candidate): candidate is PropertyTile =>
        candidate.kind === 'property' && candidate.setKey === tile.setKey,
    );

    return state.players
      .filter(
        (player) =>
          player.roomPlayerId !== bot.roomPlayerId && !player.bankrupt,
      )
      .some((opponent) =>
        setTiles.every((setTile) => {
          if (setTile.key === tile.key) {
            return true;
          }

          return state.properties.some(
            (property) =>
              property.tileKey === setTile.key &&
              property.ownerRoomPlayerId === opponent.roomPlayerId,
          );
        }),
      );
  }

  private rentPotentialScore(tile: OwnableTile): number {
    if (tile.kind === 'property') {
      return tile.hotelRent / 20;
    }

    if (tile.kind === 'airport') {
      return tile.rentByOwnedCount[tile.rentByOwnedCount.length - 1] / 4;
    }

    return (
      tile.rentMultiplierByOwnedCount[
        tile.rentMultiplierByOwnedCount.length - 1
      ] * 4
    );
  }

  private getTradeValue(
    state: GameEngineState,
    input: { cash: number; propertyKeys: string[] },
  ): number {
    return (
      input.cash +
      input.propertyKeys.reduce((sum, tileKey) => {
        const tile = this.getOwnableTile(state, tileKey);

        if (!tile) {
          return sum;
        }

        const property = this.findPropertyState(state, tileKey);
        const buildingValue =
          tile.kind === 'property'
            ? (property.houseCount + (property.hasHotel ? 5 : 0)) *
              (tile.houseCost / 2)
            : 0;

        return sum + tile.price + buildingValue;
      }, 0)
    );
  }

  private getUnmortgageCost(mortgageValue: number): number {
    return Math.ceil(mortgageValue * 1.1);
  }

  private ownsCompletePropertySet(
    state: GameEngineState,
    board: ReturnType<typeof getGameBoard>,
    roomPlayerId: string,
    setKey: PropertySetKey,
  ): boolean {
    return this.getPropertySetTiles(board, setKey).every((tile) => {
      const property = this.findPropertyState(state, tile.key);

      return property.ownerRoomPlayerId === roomPlayerId;
    });
  }

  private getPropertySetTiles(
    board: ReturnType<typeof getGameBoard>,
    setKey: PropertySetKey,
  ): PropertyTile[] {
    return board.tiles.filter(
      (tile): tile is PropertyTile =>
        tile.kind === 'property' && tile.setKey === setKey,
    );
  }

  private getDevelopmentLevel(property: GameEngineProperty): number {
    return property.hasHotel ? 5 : property.houseCount;
  }

  private getPendingOwnableTile(state: GameEngineState): OwnableTile | null {
    return state.pendingTileKey
      ? this.getOwnableTile(state, state.pendingTileKey)
      : null;
  }

  private getOwnableTile(
    state: GameEngineState,
    tileKey: string,
  ): OwnableTile | null {
    const tile = getGameBoard(state.boardKey).tiles.find(
      (candidate) => candidate.key === tileKey,
    );

    return tile && this.isOwnableTile(tile) ? tile : null;
  }

  private findPropertyState(
    state: GameEngineState,
    tileKey: string,
  ): GameEngineProperty {
    const property = state.properties.find(
      (candidate) => candidate.tileKey === tileKey,
    );

    if (!property) {
      throw new Error(`Missing property state for ${tileKey}`);
    }

    return property;
  }

  private findPlayer(
    state: GameEngineState,
    roomPlayerId: string,
  ): GameEnginePlayer | null {
    return (
      state.players.find((player) => player.roomPlayerId === roomPlayerId) ??
      null
    );
  }

  private isOwnableTile(tile: GameTile): tile is OwnableTile {
    return (
      tile.kind === 'property' ||
      tile.kind === 'airport' ||
      tile.kind === 'utility'
    );
  }

  private rollDice(): DiceRoll {
    return [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ];
  }
}
