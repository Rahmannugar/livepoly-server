import { getGameBoard } from './game-board';
import { debitPlayer } from './game-engine-money';
import { isOwnableTile } from './game-engine-properties';
import { GAME_TURN_TIMER } from '../game.constants';
import {
  GameEngineError,
  type DeclinePropertyInput,
  type GameEngineAuction,
  type GameEngineEvent,
  type GameEngineResult,
  type GameEngineState,
  type PassAuctionBidInput,
  type PlaceAuctionBidInput,
} from './game-engine.types';

const MINIMUM_AUCTION_BID = 10;
const AUCTION_BID_INCREMENT = 10;

export function declinePropertyPurchase(
  state: GameEngineState,
  input: DeclinePropertyInput,
): GameEngineResult {
  const tileKey = state.pendingTileKey;

  if (!tileKey) {
    throw new GameEngineError(
      'NO_PROPERTY_DECISION',
      'There is no property decision to resolve',
    );
  }

  const board = getGameBoard(state.boardKey);
  const tile = board.tiles.find((candidate) => candidate.key === tileKey);

  if (!tile || !isOwnableTile(tile)) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile cannot be auctioned');
  }

  const property = state.properties.find(
    (candidate) => candidate.tileKey === tile.key,
  );

  if (!property) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile cannot be auctioned');
  }

  if (property.ownerRoomPlayerId) {
    throw new GameEngineError(
      'PROPERTY_ALREADY_OWNED',
      'Property is already owned',
    );
  }

  const activeRoomPlayerIds = state.players
    .filter((player) => !player.bankrupt)
    .sort((left, right) => left.seatNumber - right.seatNumber)
    .map((player) => player.roomPlayerId);

  const auction: GameEngineAuction = {
    tileKey: tile.key,
    currentBid: 0,
    highestBidderRoomPlayerId: null,
    currentBidderRoomPlayerId: activeRoomPlayerIds[0] ?? null,
    bidExpiresAt: getNextAuctionBidExpiresAt(state),
    activeRoomPlayerIds,
    passedRoomPlayerIds: [],
  };

  return {
    state: {
      ...state,
      phase: 'awaiting_auction_bid',
      pendingTileKey: null,
      auction,
    },
    events: [
      {
        type: 'property_purchase_declined',
        roomPlayerId: input.roomPlayerId,
        tileKey: tile.key,
      },
      {
        type: 'auction_started',
        tileKey: tile.key,
        activeRoomPlayerIds,
      },
    ],
  };
}

export function placeAuctionBid(
  state: GameEngineState,
  input: PlaceAuctionBidInput,
): GameEngineResult {
  const auction = assertActiveAuction(state);

  assertAuctionPlayerActive(auction, input.roomPlayerId);
  assertAuctionPlayerCanAct(auction, input.roomPlayerId);

  const minimumBid = getMinimumAuctionBid(auction);

  if (!Number.isInteger(input.amount) || input.amount < minimumBid) {
    throw new GameEngineError(
      'INVALID_AUCTION_BID',
      `Auction bid must be at least ${minimumBid}`,
    );
  }

  const bidder = state.players.find(
    (player) => player.roomPlayerId === input.roomPlayerId,
  );

  if (!bidder) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
  }

  if (bidder.cash < input.amount) {
    throw new GameEngineError(
      'INSUFFICIENT_FUNDS',
      'Player does not have enough cash',
    );
  }

  return {
    state: {
      ...state,
      auction: {
        ...auction,
        currentBid: input.amount,
        highestBidderRoomPlayerId: input.roomPlayerId,
        currentBidderRoomPlayerId: getNextAuctionBidderRoomPlayerId(
          auction,
          input.roomPlayerId,
        ),
        bidExpiresAt: getNextAuctionBidExpiresAt(state),
      },
    },
    events: [
      {
        type: 'auction_bid_placed',
        roomPlayerId: input.roomPlayerId,
        tileKey: auction.tileKey,
        amount: input.amount,
      },
    ],
  };
}

export function passAuctionBid(
  state: GameEngineState,
  input: PassAuctionBidInput,
): GameEngineResult {
  const auction = assertActiveAuction(state);

  assertAuctionPlayerActive(auction, input.roomPlayerId);
  assertAuctionPlayerCanAct(auction, input.roomPlayerId);

  const nextAuction: GameEngineAuction = {
    ...auction,
    passedRoomPlayerIds: Array.from(
      new Set([...auction.passedRoomPlayerIds, input.roomPlayerId]),
    ),
  };
  nextAuction.currentBidderRoomPlayerId = getNextAuctionBidderRoomPlayerId(
    nextAuction,
    input.roomPlayerId,
  );
  nextAuction.bidExpiresAt = getNextAuctionBidExpiresAt(state);

  const passEvent: GameEngineEvent = {
    type: 'auction_bid_passed',
    roomPlayerId: input.roomPlayerId,
    tileKey: auction.tileKey,
  };

  const activeBidders = nextAuction.activeRoomPlayerIds.filter(
    (roomPlayerId) => !nextAuction.passedRoomPlayerIds.includes(roomPlayerId),
  );

  if (nextAuction.highestBidderRoomPlayerId && activeBidders.length <= 1) {
    return completeAuctionWithWinner(state, nextAuction, passEvent);
  }

  if (!nextAuction.highestBidderRoomPlayerId && activeBidders.length === 0) {
    return completeAuctionWithoutWinner(state, nextAuction, passEvent);
  }

  return {
    state: {
      ...state,
      auction: nextAuction,
    },
    events: [passEvent],
  };
}

function completeAuctionWithWinner(
  state: GameEngineState,
  auction: GameEngineAuction,
  passEvent: GameEngineEvent,
): GameEngineResult {
  if (!auction.highestBidderRoomPlayerId) {
    return completeAuctionWithoutWinner(state, auction, passEvent);
  }

  const debitedState = debitPlayer(
    state,
    auction.highestBidderRoomPlayerId,
    auction.currentBid,
  );

  return {
    state: {
      ...debitedState,
      phase: 'awaiting_turn_end',
      auction: null,
      properties: debitedState.properties.map((property) => {
        if (property.tileKey !== auction.tileKey) {
          return property;
        }

        return {
          ...property,
          ownerRoomPlayerId: auction.highestBidderRoomPlayerId,
        };
      }),
    },
    events: [
      passEvent,
      {
        type: 'auction_won',
        roomPlayerId: auction.highestBidderRoomPlayerId,
        tileKey: auction.tileKey,
        amount: auction.currentBid,
      },
    ],
  };
}

function completeAuctionWithoutWinner(
  state: GameEngineState,
  auction: GameEngineAuction,
  passEvent: GameEngineEvent,
): GameEngineResult {
  return {
    state: {
      ...state,
      phase: 'awaiting_turn_end',
      auction: null,
      properties: state.properties.map((property) => {
        if (property.tileKey !== auction.tileKey) {
          return property;
        }

        return {
          ...property,
          ownerRoomPlayerId: null,
        };
      }),
    },
    events: [passEvent],
  };
}

function assertActiveAuction(state: GameEngineState): GameEngineAuction {
  if (state.phase !== 'awaiting_auction_bid' || !state.auction) {
    throw new GameEngineError(
      'NO_ACTIVE_AUCTION',
      'There is no active auction',
    );
  }

  return state.auction;
}

export function getCurrentAuctionBidderRoomPlayerId(
  auction: GameEngineAuction | null | undefined,
): string | null {
  if (!auction) {
    return null;
  }

  if (
    auction.currentBidderRoomPlayerId &&
    auction.activeRoomPlayerIds.includes(auction.currentBidderRoomPlayerId) &&
    !auction.passedRoomPlayerIds.includes(auction.currentBidderRoomPlayerId)
  ) {
    return auction.currentBidderRoomPlayerId;
  }

  return auction.activeRoomPlayerIds.find(
    (roomPlayerId) => !auction.passedRoomPlayerIds.includes(roomPlayerId),
  ) ?? null;
}

export function getMinimumAuctionBid(auction: GameEngineAuction): number {
  if (auction.currentBid <= 0) {
    return MINIMUM_AUCTION_BID;
  }

  return auction.currentBid + AUCTION_BID_INCREMENT;
}

export function getAuctionBidDelay(state: GameEngineState): number {
  if (!state.auction?.bidExpiresAt) {
    return GAME_TURN_TIMER.auctionBidTimeoutMs;
  }

  return Math.max(state.auction.bidExpiresAt - Date.now(), 0);
}

function getNextAuctionBidExpiresAt(state: GameEngineState): number {
  const bidExpiresAt = Date.now() + GAME_TURN_TIMER.auctionBidTimeoutMs;

  return state.expiresAt
    ? Math.min(bidExpiresAt, state.expiresAt)
    : bidExpiresAt;
}

function assertAuctionPlayerActive(
  auction: GameEngineAuction,
  roomPlayerId: string,
): void {
  if (
    !auction.activeRoomPlayerIds.includes(roomPlayerId) ||
    auction.passedRoomPlayerIds.includes(roomPlayerId)
  ) {
    throw new GameEngineError(
      'AUCTION_PLAYER_NOT_ACTIVE',
      'Player is not active in this auction',
    );
  }
}

function assertAuctionPlayerCanAct(
  auction: GameEngineAuction,
  roomPlayerId: string,
): void {
  if (getCurrentAuctionBidderRoomPlayerId(auction) !== roomPlayerId) {
    throw new GameEngineError(
      'AUCTION_PLAYER_NOT_CURRENT',
      "It is not this player's auction turn",
    );
  }
}

function getNextAuctionBidderRoomPlayerId(
  auction: GameEngineAuction,
  currentRoomPlayerId: string,
): string | null {
  const activeBidders = auction.activeRoomPlayerIds.filter(
    (roomPlayerId) => !auction.passedRoomPlayerIds.includes(roomPlayerId),
  );

  if (activeBidders.length === 0) {
    return null;
  }

  const currentIndex = auction.activeRoomPlayerIds.indexOf(currentRoomPlayerId);

  for (let offset = 1; offset <= auction.activeRoomPlayerIds.length; offset++) {
    const candidate =
      auction.activeRoomPlayerIds[
        (currentIndex + offset + auction.activeRoomPlayerIds.length) %
          auction.activeRoomPlayerIds.length
      ];

    if (!candidate || auction.passedRoomPlayerIds.includes(candidate)) {
      continue;
    }

    if (
      auction.highestBidderRoomPlayerId &&
      activeBidders.length <= 1 &&
      candidate === auction.highestBidderRoomPlayerId
    ) {
      return null;
    }

    return candidate;
  }

  return null;
}
