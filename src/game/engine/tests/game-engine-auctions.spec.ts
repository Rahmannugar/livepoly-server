import {
  declinePropertyPurchase,
  passAuctionBid,
  placeAuctionBid,
} from '../game-engine-auctions';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-auctions', () => {
  it('starts an auction when a player declines to buy pending property', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: 'nigeria',
    });

    const result = declinePropertyPurchase(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_auction_bid',
      pendingTileKey: null,
      auction: {
        tileKey: 'nigeria',
        currentBid: 0,
        highestBidderRoomPlayerId: null,
        activeRoomPlayerIds: [
          'room-player-1',
          'room-player-2',
          'room-player-3',
        ],
        passedRoomPlayerIds: [],
      },
    });
    expect(result.events).toEqual([
      {
        type: 'property_purchase_declined',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
      },
      {
        type: 'auction_started',
        tileKey: 'nigeria',
        activeRoomPlayerIds: [
          'room-player-1',
          'room-player-2',
          'room-player-3',
        ],
      },
    ]);
  });

  it('places a higher auction bid', () => {
    const auctionState = declinePropertyPurchase(
      createGameEngineState({
        phase: 'awaiting_property_decision',
        pendingTileKey: 'nigeria',
      }),
      {
        roomPlayerId: 'room-player-1',
      },
    ).state;

    const result = placeAuctionBid(auctionState, {
      roomPlayerId: 'room-player-2',
      amount: 75,
    });

    expect(result.state.auction).toMatchObject({
      tileKey: 'nigeria',
      currentBid: 75,
      highestBidderRoomPlayerId: 'room-player-2',
    });
    expect(result.events).toEqual([
      {
        type: 'auction_bid_placed',
        roomPlayerId: 'room-player-2',
        tileKey: 'nigeria',
        amount: 75,
      },
    ]);
  });

  it('rejects bids that are not higher than the current bid', () => {
    const auctionState = placeAuctionBid(
      declinePropertyPurchase(
        createGameEngineState({
          phase: 'awaiting_property_decision',
          pendingTileKey: 'nigeria',
        }),
        {
          roomPlayerId: 'room-player-1',
        },
      ).state,
      {
        roomPlayerId: 'room-player-2',
        amount: 75,
      },
    ).state;

    expect(() =>
      placeAuctionBid(auctionState, {
        roomPlayerId: 'room-player-3',
        amount: 75,
      }),
    ).toThrow(
      new GameEngineError(
        'INVALID_AUCTION_BID',
        'Auction bid must be higher than the current bid',
      ),
    );
  });

  it('records a player passing an auction bid', () => {
    const auctionState = declinePropertyPurchase(
      createGameEngineState({
        phase: 'awaiting_property_decision',
        pendingTileKey: 'nigeria',
      }),
      {
        roomPlayerId: 'room-player-1',
      },
    ).state;

    const result = passAuctionBid(auctionState, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.auction).toMatchObject({
      passedRoomPlayerIds: ['room-player-1'],
    });
    expect(result.events).toEqual([
      {
        type: 'auction_bid_passed',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
      },
    ]);
  });

  it('awards the property when all other active players pass', () => {
    const auctionState = placeAuctionBid(
      declinePropertyPurchase(
        createGameEngineState({
          phase: 'awaiting_property_decision',
          pendingTileKey: 'nigeria',
        }),
        {
          roomPlayerId: 'room-player-1',
        },
      ).state,
      {
        roomPlayerId: 'room-player-2',
        amount: 75,
      },
    ).state;

    const afterFirstPass = passAuctionBid(auctionState, {
      roomPlayerId: 'room-player-1',
    }).state;

    const result = passAuctionBid(afterFirstPass, {
      roomPlayerId: 'room-player-3',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      auction: null,
    });
    expect(result.state.players[1].cash).toBe(1425);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-2',
    });
    expect(result.events).toEqual([
      {
        type: 'auction_bid_passed',
        roomPlayerId: 'room-player-3',
        tileKey: 'nigeria',
      },
      {
        type: 'auction_won',
        roomPlayerId: 'room-player-2',
        tileKey: 'nigeria',
        amount: 75,
      },
    ]);
  });

  it('ends auction without owner when everyone passes without a bid', () => {
    const auctionState = declinePropertyPurchase(
      createGameEngineState({
        phase: 'awaiting_property_decision',
        pendingTileKey: 'nigeria',
      }),
      {
        roomPlayerId: 'room-player-1',
      },
    ).state;

    const afterFirstPass = passAuctionBid(auctionState, {
      roomPlayerId: 'room-player-1',
    }).state;

    const afterSecondPass = passAuctionBid(afterFirstPass, {
      roomPlayerId: 'room-player-2',
    }).state;

    const result = passAuctionBid(afterSecondPass, {
      roomPlayerId: 'room-player-3',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      auction: null,
    });
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      ownerRoomPlayerId: null,
    });
  });

  it('rejects bids from players who already passed', () => {
    const auctionState = passAuctionBid(
      declinePropertyPurchase(
        createGameEngineState({
          phase: 'awaiting_property_decision',
          pendingTileKey: 'nigeria',
        }),
        {
          roomPlayerId: 'room-player-1',
        },
      ).state,
      {
        roomPlayerId: 'room-player-1',
      },
    ).state;

    expect(() =>
      placeAuctionBid(auctionState, {
        roomPlayerId: 'room-player-1',
        amount: 75,
      }),
    ).toThrow(
      new GameEngineError(
        'AUCTION_PLAYER_NOT_ACTIVE',
        'Player is not active in this auction',
      ),
    );
  });
});
