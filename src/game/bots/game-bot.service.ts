import { Injectable } from '@nestjs/common';
import { getGameBoard } from '../engine/game-board';
import {
  getCurrentAuctionBidderRoomPlayerId,
  getMinimumAuctionBid,
} from '../engine/game-engine-auctions';
import type {
  AirportTile,
  GameTile,
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

    if (bot.cash >= state.debt.amount) {
      return {
        type: 'pay_debt',
        payload: { roomPlayerId: bot.roomPlayerId },
      };
    }

    const buildingToSell = this.findBuildingToSell(state, bot.roomPlayerId);

    if (buildingToSell) {
      return {
        type: 'sell_building',
        payload: {
          roomPlayerId: bot.roomPlayerId,
          tileKey: buildingToSell.tileKey,
        },
      };
    }

    const propertyToMortgage = this.findPropertyToMortgage(
      state,
      bot.roomPlayerId,
    );

    if (propertyToMortgage) {
      return {
        type: 'mortgage_property',
        payload: {
          roomPlayerId: bot.roomPlayerId,
          tileKey: propertyToMortgage.tileKey,
        },
      };
    }

    return {
      type: 'declare_bankruptcy',
      payload: {
        roomPlayerId: bot.roomPlayerId,
        creditorRoomPlayerId: state.debt.creditorRoomPlayerId,
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

  private isOwnableTile(tile: GameTile): tile is OwnableTile {
    return (
      tile.kind === 'property' ||
      tile.kind === 'airport' ||
      tile.kind === 'utility'
    );
  }

  private findBuildingToSell(
    state: GameEngineState,
    roomPlayerId: string,
  ): GameEngineProperty | null {
    return (
      state.properties.find(
        (property) =>
          property.ownerRoomPlayerId === roomPlayerId &&
          (property.hasHotel || property.houseCount > 0),
      ) ?? null
    );
  }

  private findPropertyToMortgage(
    state: GameEngineState,
    roomPlayerId: string,
  ): GameEngineProperty | null {
    return (
      state.properties.find(
        (property) =>
          property.ownerRoomPlayerId === roomPlayerId &&
          !property.mortgaged &&
          !property.hasHotel &&
          property.houseCount === 0,
      ) ?? null
    );
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

  private rollDice(): DiceRoll {
    return [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ];
  }
}
