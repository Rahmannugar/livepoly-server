import {
  reduceGameEngineIntent,
  type GameEngineIntent,
} from '../game-engine-intents';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState, TEST_BOARD_TILES } from './game-engine.test-factory';

describe('game-engine-intents', () => {
  it('runs roll and move intent', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
    });

    const result = reduceGameEngineIntent(state, {
      type: 'roll_and_move',
      payload: {
        roomPlayerId: 'room-player-1',
        dice: [1, 2],
      },
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.cheapPropertyPair,
    });
    expect(result.events).toContainEqual({
      type: 'player_moved',
      roomPlayerId: 'room-player-1',
      fromPosition: 0,
      toPosition: 3,
      dice: [1, 2],
    });
  });

  it('runs buy property intent', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.cheapProperty,
    });

    const result = reduceGameEngineIntent(state, {
      type: 'buy_property',
      payload: {
        roomPlayerId: 'room-player-1',
      },
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-1',
    });
  });

  it('runs building intent', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty || property.tileKey === TEST_BOARD_TILES.cheapPropertyPair) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    const result = reduceGameEngineIntent(state, {
      type: 'build_property',
      payload: {
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
      },
    });

    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      houseCount: 1,
    });
    expect(result.events).toEqual([
      {
        type: 'property_house_built',
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
        houseCount: 1,
        amount: 50,
      },
    ]);
  });

  it('runs mortgage intent', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    const result = reduceGameEngineIntent(state, {
      type: 'mortgage_property',
      payload: {
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
      },
    });

    expect(result.state.players[0].cash).toBe(1530);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      mortgaged: true,
    });
  });

  it('runs timed finish intent', () => {
    const result = reduceGameEngineIntent(
      createGameEngineState({
        phase: 'awaiting_roll',
      }),
      {
        type: 'finish_game_by_time',
        payload: {
          finishedAt: 1779150000000,
        },
      },
    );

    expect(result.state.phase).toBe('finished');
    expect(result.events[0]).toMatchObject({
      type: 'game_finished_by_time',
      finishedAt: 1779150000000,
    });
  });

  it('throws engine errors from invalid intents', () => {
    const intent: GameEngineIntent = {
      type: 'roll_and_move',
      payload: {
        roomPlayerId: 'room-player-2',
        dice: [1, 2],
      },
    };

    expect(() =>
      reduceGameEngineIntent(createGameEngineState(), intent),
    ).toThrow(GameEngineError);
  });

  it('does not mutate the original state', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.cheapProperty,
    });

    reduceGameEngineIntent(state, {
      type: 'buy_property',
      payload: {
        roomPlayerId: 'room-player-1',
      },
    });

    expect(state.phase).toBe('awaiting_property_decision');
    expect(state.pendingTileKey).toBe(TEST_BOARD_TILES.cheapProperty);
    expect(
      state.properties.find((property) => property.tileKey === TEST_BOARD_TILES.cheapProperty),
    ).toMatchObject({
      ownerRoomPlayerId: null,
    });
  });
});
