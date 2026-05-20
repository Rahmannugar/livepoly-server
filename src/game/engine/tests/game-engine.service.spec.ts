import { GameEngineService } from '../game-engine.service';
import { createGameEngineState } from './game-engine.test-factory';

describe('GameEngineService', () => {
  let service: GameEngineService;

  beforeEach(() => {
    service = new GameEngineService();
  });

  it('returns state and events for roll and move', () => {
    const result = service.rollAndMove(createGameEngineState(), {
      roomPlayerId: 'room-player-1',
      dice: [3, 4],
    });

    expect(result.state.phase).toBe('awaiting_turn_end');
    expect(result.events).toEqual([
      {
        type: 'player_moved',
        roomPlayerId: 'room-player-1',
        fromPosition: 0,
        toPosition: 7,
        dice: [3, 4],
      },
      {
        type: 'player_landed_on_tile',
        roomPlayerId: 'room-player-1',
        tileKey: 'chance_1',
        tileKind: 'chance',
      },
      {
        type: 'card_drawn',
        roomPlayerId: 'room-player-1',
        deckKey: 'chance',
        cardKey: 'chance_bank_dividend',
      },
      {
        type: 'card_applied',
        roomPlayerId: 'room-player-1',
        deckKey: 'chance',
        cardKey: 'chance_bank_dividend',
        effectType: 'collect_money',
      },
    ]);
  });

  it('returns state and events for buy property', () => {
    const result = service.buyProperty(
      createGameEngineState({
        phase: 'awaiting_property_decision',
        pendingTileKey: 'nigeria',
      }),
      {
        roomPlayerId: 'room-player-1',
      },
    );

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });
    expect(result.state.players[0].cash).toBe(1440);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-1',
    });
    expect(result.events).toEqual([
      {
        type: 'property_bought',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
        amount: 60,
      },
    ]);
  });

  it('returns state and events for end turn', () => {
    const state = createGameEngineState();

    state.players[0].position = 38;

    const moved = service.rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [1, 2],
    });

    const bought = service.buyProperty(moved.state, {
      roomPlayerId: 'room-player-1',
    });

    const result = service.endTurn(bought.state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.currentTurnRoomPlayerId).toBe('room-player-2');
    expect(result.events).toEqual([
      {
        type: 'turn_ended',
        roomPlayerId: 'room-player-1',
        nextRoomPlayerId: 'room-player-2',
        turnNumber: 2,
      },
    ]);
  });
});
