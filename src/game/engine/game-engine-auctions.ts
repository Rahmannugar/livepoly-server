import { getGameBoard } from './game-board';
import { debitPlayer } from './game-engine-money';
import { isOwnableTile } from './game-engine-properties';
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

  if (!Number.isInteger(input.amount) || input.amount <= auction.currentBid) {
    throw new GameEngineError(
      'INVALID_AUCTION_BID',
      'Auction bid must be higher than the current bid',
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

  const nextAuction: GameEngineAuction = {
    ...auction,
    passedRoomPlayerIds: Array.from(
      new Set([...auction.passedRoomPlayerIds, input.roomPlayerId]),
    ),
  };

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
