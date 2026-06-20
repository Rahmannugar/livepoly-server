import { randomUUID } from 'crypto';
import { getGameBoard } from './game-board';
import type {
  AirportTile,
  PropertyTile,
  UtilityTile,
} from './game-board.types';
import {
  creditPlayer,
  findPlayer,
  transferPlayerCash,
} from './game-engine-money';
import {
  GameEngineError,
  type AcceptTradeInput,
  type CancelTradeInput,
  type GameEngineEvent,
  type GameEngineProperty,
  type GameEngineResult,
  type GameEngineState,
  type GameEngineTradeOffer,
  type ProposeTradeInput,
  type RejectTradeInput,
} from './game-engine.types';
import { GAME_BOTS } from '../game.constants';

type TradeableTile = PropertyTile | AirportTile | UtilityTile;

export function proposeTrade(
  state: GameEngineState,
  input: ProposeTradeInput,
): GameEngineResult {
  assertCanTrade(state, input.roomPlayerId);

  if (input.roomPlayerId === input.toRoomPlayerId) {
    throw new GameEngineError(
      'INVALID_TRADE',
      'Trade must target another player',
    );
  }

  if (state.tradeOffer) {
    throw new GameEngineError(
      'TRADE_NOT_ALLOWED',
      'A trade is already being considered',
    );
  }

  const trade: GameEngineTradeOffer = {
    id: input.tradeId ?? randomUUID(),
    fromRoomPlayerId: input.roomPlayerId,
    toRoomPlayerId: input.toRoomPlayerId,
    offeredCash: normalizeCash(input.offeredCash),
    requestedCash: normalizeCash(input.requestedCash),
    offeredPropertyKeys: uniquePropertyKeys(input.offeredPropertyKeys),
    requestedPropertyKeys: uniquePropertyKeys(input.requestedPropertyKeys),
    createdAt: Date.now(),
  };

  validateTrade(state, trade);
  const proposedState = markBotTradeProposal(state, trade.fromRoomPlayerId);

  const proposedEvent: GameEngineEvent = {
    type: 'trade_proposed',
    tradeId: trade.id,
    fromRoomPlayerId: trade.fromRoomPlayerId,
    toRoomPlayerId: trade.toRoomPlayerId,
    offeredCash: trade.offeredCash,
    requestedCash: trade.requestedCash,
    offeredPropertyKeys: [...trade.offeredPropertyKeys],
    requestedPropertyKeys: [...trade.requestedPropertyKeys],
  };

  const target = findPlayer(proposedState, trade.toRoomPlayerId);

  if (target.playerType === 'bot') {
    if (shouldBotAcceptTrade(proposedState, trade)) {
      return acceptTradeOffer(proposedState, trade, [proposedEvent]);
    }

    return {
      state: {
        ...proposedState,
        tradeOffer: null,
      },
      events: [
        proposedEvent,
        {
          type: 'trade_rejected',
          tradeId: trade.id,
          fromRoomPlayerId: trade.fromRoomPlayerId,
          toRoomPlayerId: trade.toRoomPlayerId,
          rejectedByRoomPlayerId: trade.toRoomPlayerId,
        },
      ],
    };
  }

  return {
    state: {
      ...proposedState,
      tradeOffer: trade,
    },
    events: [proposedEvent],
  };
}

export function acceptTrade(
  state: GameEngineState,
  input: AcceptTradeInput,
): GameEngineResult {
  const trade = assertTradeOffer(state, input.tradeId);

  if (trade.toRoomPlayerId !== input.roomPlayerId) {
    throw new GameEngineError(
      'TRADE_NOT_ALLOWED',
      'Only the target player can accept this trade',
    );
  }

  return acceptTradeOffer(state, trade, []);
}

export function rejectTrade(
  state: GameEngineState,
  input: RejectTradeInput,
): GameEngineResult {
  const trade = assertTradeOffer(state, input.tradeId);

  if (trade.toRoomPlayerId !== input.roomPlayerId) {
    throw new GameEngineError(
      'TRADE_NOT_ALLOWED',
      'Only the target player can reject this trade',
    );
  }

  return {
    state: {
      ...state,
      tradeOffer: null,
    },
    events: [
      {
        type: 'trade_rejected',
        tradeId: trade.id,
        fromRoomPlayerId: trade.fromRoomPlayerId,
        toRoomPlayerId: trade.toRoomPlayerId,
        rejectedByRoomPlayerId: input.roomPlayerId,
      },
    ],
  };
}

export function cancelTrade(
  state: GameEngineState,
  input: CancelTradeInput,
): GameEngineResult {
  const trade = assertTradeOffer(state, input.tradeId);

  if (trade.fromRoomPlayerId !== input.roomPlayerId) {
    throw new GameEngineError(
      'TRADE_NOT_ALLOWED',
      'Only the proposing player can cancel this trade',
    );
  }

  return {
    state: {
      ...state,
      tradeOffer: null,
    },
    events: [
      {
        type: 'trade_cancelled',
        tradeId: trade.id,
        fromRoomPlayerId: trade.fromRoomPlayerId,
        toRoomPlayerId: trade.toRoomPlayerId,
      },
    ],
  };
}

function acceptTradeOffer(
  state: GameEngineState,
  trade: GameEngineTradeOffer,
  previousEvents: GameEngineEvent[],
): GameEngineResult {
  validateTrade(state, trade);

  let nextState = state;
  const events = [...previousEvents];

  const fromLiquidation = liquidateTradeBuildings(
    nextState,
    trade.id,
    trade.fromRoomPlayerId,
    trade.offeredPropertyKeys,
  );
  nextState = fromLiquidation.state;
  events.push(...fromLiquidation.events);

  const toLiquidation = liquidateTradeBuildings(
    nextState,
    trade.id,
    trade.toRoomPlayerId,
    trade.requestedPropertyKeys,
  );
  nextState = toLiquidation.state;
  events.push(...toLiquidation.events);

  if (trade.offeredCash > 0) {
    nextState = transferPlayerCash(
      nextState,
      trade.fromRoomPlayerId,
      trade.toRoomPlayerId,
      trade.offeredCash,
    );
  }

  if (trade.requestedCash > 0) {
    nextState = transferPlayerCash(
      nextState,
      trade.toRoomPlayerId,
      trade.fromRoomPlayerId,
      trade.requestedCash,
    );
  }

  nextState = transferProperties(nextState, {
    tileKeys: trade.offeredPropertyKeys,
    ownerRoomPlayerId: trade.toRoomPlayerId,
  });
  nextState = transferProperties(nextState, {
    tileKeys: trade.requestedPropertyKeys,
    ownerRoomPlayerId: trade.fromRoomPlayerId,
  });

  return {
    state: {
      ...nextState,
      tradeOffer: null,
    },
    events: [
      ...events,
      {
        type: 'trade_accepted',
        tradeId: trade.id,
        fromRoomPlayerId: trade.fromRoomPlayerId,
        toRoomPlayerId: trade.toRoomPlayerId,
      },
    ],
  };
}

function assertCanTrade(state: GameEngineState, roomPlayerId: string): void {
  if (state.phase === 'finished' || state.phase === 'cancelled') {
    throw new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active');
  }

  if (state.phase !== 'awaiting_turn_end') {
    throw new GameEngineError(
      'TRADE_NOT_ALLOWED',
      'Trades can only be made after a move is settled',
    );
  }

  if (state.currentTurnRoomPlayerId !== roomPlayerId) {
    throw new GameEngineError(
      'NOT_CURRENT_TURN',
      "It is not this player's turn",
    );
  }

  if (state.debt) {
    throw new GameEngineError(
      'DEBT_RESOLUTION_REQUIRED',
      'Player must resolve debt before trading',
    );
  }
}

function assertTradeOffer(
  state: GameEngineState,
  tradeId: string,
): GameEngineTradeOffer {
  if (!state.tradeOffer || state.tradeOffer.id !== tradeId) {
    throw new GameEngineError('TRADE_NOT_FOUND', 'Trade offer not found');
  }

  return state.tradeOffer;
}

function validateTrade(
  state: GameEngineState,
  trade: GameEngineTradeOffer,
): void {
  const fromPlayer = findPlayer(state, trade.fromRoomPlayerId);
  const toPlayer = findPlayer(state, trade.toRoomPlayerId);

  if (fromPlayer.bankrupt || toPlayer.bankrupt) {
    throw new GameEngineError('INVALID_TRADE', 'Bankrupt players cannot trade');
  }

  if (
    fromPlayer.cash < trade.offeredCash ||
    toPlayer.cash < trade.requestedCash
  ) {
    throw new GameEngineError(
      'INSUFFICIENT_FUNDS',
      'Trade cash is no longer available',
    );
  }

  if (
    trade.offeredCash === 0 &&
    trade.requestedCash === 0 &&
    trade.offeredPropertyKeys.length === 0 &&
    trade.requestedPropertyKeys.length === 0
  ) {
    throw new GameEngineError('INVALID_TRADE', 'Trade cannot be empty');
  }

  assertNoDuplicateCrossTradeProperties(trade);
  assertPropertiesOwnedBy(
    state,
    trade.offeredPropertyKeys,
    trade.fromRoomPlayerId,
  );
  assertPropertiesOwnedBy(
    state,
    trade.requestedPropertyKeys,
    trade.toRoomPlayerId,
  );
}

function normalizeCash(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new GameEngineError(
      'INVALID_TRADE',
      'Trade cash must be a whole number',
    );
  }

  return value;
}

function uniquePropertyKeys(values: string[]): string[] {
  const uniqueValues = [...new Set(values.map((value) => value.trim()))].filter(
    Boolean,
  );

  if (uniqueValues.length !== values.length) {
    throw new GameEngineError(
      'INVALID_TRADE',
      'Trade cannot include duplicate properties',
    );
  }

  return uniqueValues;
}

function assertNoDuplicateCrossTradeProperties(
  trade: GameEngineTradeOffer,
): void {
  const offered = new Set(trade.offeredPropertyKeys);

  if (trade.requestedPropertyKeys.some((tileKey) => offered.has(tileKey))) {
    throw new GameEngineError(
      'INVALID_TRADE',
      'The same property cannot be on both sides of a trade',
    );
  }
}

function assertPropertiesOwnedBy(
  state: GameEngineState,
  tileKeys: string[],
  ownerRoomPlayerId: string,
): void {
  for (const tileKey of tileKeys) {
    const property = findPropertyState(state, tileKey);

    if (property.ownerRoomPlayerId !== ownerRoomPlayerId) {
      throw new GameEngineError(
        'PROPERTY_NOT_OWNED',
        'Player does not own one of the traded properties',
      );
    }

    getTradeableTile(state, tileKey);
  }
}

function liquidateTradeBuildings(
  state: GameEngineState,
  tradeId: string,
  roomPlayerId: string,
  tileKeys: string[],
): { state: GameEngineState; events: GameEngineEvent[] } {
  let nextState = state;
  const events: GameEngineEvent[] = [];

  for (const tileKey of tileKeys) {
    const property = findPropertyState(nextState, tileKey);
    const tile = getTradeableTile(nextState, tileKey);

    if (tile.kind !== 'property') {
      continue;
    }

    const liquidationAmount =
      (property.houseCount + (property.hasHotel ? 5 : 0)) *
      (tile.houseCost / 2);

    if (liquidationAmount <= 0) {
      continue;
    }

    nextState = creditPlayer(nextState, roomPlayerId, liquidationAmount);
    nextState = updatePropertyState(nextState, tileKey, {
      houseCount: 0,
      hasHotel: false,
    });
    events.push({
      type: 'trade_buildings_liquidated',
      tradeId,
      roomPlayerId,
      tileKey,
      amount: liquidationAmount,
    });
  }

  return { state: nextState, events };
}

function transferProperties(
  state: GameEngineState,
  input: { tileKeys: string[]; ownerRoomPlayerId: string },
): GameEngineState {
  if (input.tileKeys.length === 0) {
    return state;
  }

  const tileKeys = new Set(input.tileKeys);

  return {
    ...state,
    properties: state.properties.map((property) => {
      if (!tileKeys.has(property.tileKey)) {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: input.ownerRoomPlayerId,
      };
    }),
  };
}

function shouldBotAcceptTrade(
  state: GameEngineState,
  trade: GameEngineTradeOffer,
): boolean {
  const bot = findPlayer(state, trade.toRoomPlayerId);
  const botReceives = getTradeValue(state, {
    cash: trade.offeredCash,
    propertyKeys: trade.offeredPropertyKeys,
  });
  const botGives = getTradeValue(state, {
    cash: trade.requestedCash,
    propertyKeys: trade.requestedPropertyKeys,
  });

  return (
    botReceives >=
    botGives * GAME_BOTS.tradeAcceptanceMargin[bot.botDifficulty ?? 'normal']
  );
}

function markBotTradeProposal(
  state: GameEngineState,
  roomPlayerId: string,
): GameEngineState {
  const player = findPlayer(state, roomPlayerId);

  if (player.playerType !== 'bot') {
    return state;
  }

  return {
    ...state,
    players: state.players.map((candidate) => {
      if (candidate.roomPlayerId !== roomPlayerId) {
        return candidate;
      }

      return {
        ...candidate,
        lastBotTradeProposalTurnNumber: state.turnNumber,
      };
    }),
  };
}

function getTradeValue(
  state: GameEngineState,
  input: { cash: number; propertyKeys: string[] },
): number {
  return (
    input.cash +
    input.propertyKeys.reduce((sum, tileKey) => {
      const property = findPropertyState(state, tileKey);
      const tile = getTradeableTile(state, tileKey);
      const buildingValue =
        tile.kind === 'property'
          ? (property.houseCount + (property.hasHotel ? 5 : 0)) *
            (tile.houseCost / 2)
          : 0;

      return sum + tile.price + buildingValue;
    }, 0)
  );
}

function getTradeableTile(
  state: GameEngineState,
  tileKey: string,
): TradeableTile {
  const tile = getGameBoard(state.boardKey).tiles.find(
    (candidate) => candidate.key === tileKey,
  );

  if (
    !tile ||
    (tile.kind !== 'property' &&
      tile.kind !== 'airport' &&
      tile.kind !== 'utility')
  ) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile is not tradeable');
  }

  return tile;
}

function findPropertyState(
  state: GameEngineState,
  tileKey: string,
): GameEngineProperty {
  const property = state.properties.find(
    (candidate) => candidate.tileKey === tileKey,
  );

  if (!property) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile is not ownable');
  }

  return property;
}

function updatePropertyState(
  state: GameEngineState,
  tileKey: string,
  updates: Partial<GameEngineProperty>,
): GameEngineState {
  return {
    ...state,
    properties: state.properties.map((candidate) => {
      if (candidate.tileKey !== tileKey) {
        return candidate;
      }

      return {
        ...candidate,
        ...updates,
      };
    }),
  };
}
