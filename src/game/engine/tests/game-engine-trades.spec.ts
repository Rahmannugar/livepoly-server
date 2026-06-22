import { proposeTrade } from '../game-engine-trades';
import { GameEngineError } from '../game-engine.types';
import {
  createGameEnginePlayer,
  createGameEngineState,
  TEST_BOARD_TILES,
} from './game-engine.test-factory';

describe('game-engine-trades', () => {
  it('rejects a trade with value on only one side', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      properties: createGameEngineState().properties.map((property) =>
        property.tileKey === TEST_BOARD_TILES.cheapProperty
          ? { ...property, ownerRoomPlayerId: 'room-player-1' }
          : property,
      ),
    });

    expect(() =>
      proposeTrade(state, {
        roomPlayerId: 'room-player-1',
        toRoomPlayerId: 'room-player-2',
        offeredCash: 0,
        requestedCash: 0,
        offeredPropertyKeys: [TEST_BOARD_TILES.cheapProperty],
        requestedPropertyKeys: [],
      }),
    ).toThrow(
      new GameEngineError(
        'INVALID_TRADE',
        'Both players must offer cash or property',
      ),
    );
  });

  it.each([
    ['easy', 'trade_accepted'],
    ['hard', 'trade_rejected'],
  ] as const)(
    '%s bot evaluates an opponent set-completing trade strategically',
    (difficulty, expectedOutcome) => {
      const baseState = createGameEngineState();
      const state = createGameEngineState({
        phase: 'awaiting_turn_end',
        players: [
          createGameEnginePlayer(),
          createGameEnginePlayer({
            roomPlayerId: 'room-player-2',
            userId: null,
            username: null,
            playerType: 'bot',
            botDifficulty: difficulty,
            botName: 'Atlas',
            seatNumber: 2,
          }),
        ],
        properties: baseState.properties.map((property) => {
          if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
            return { ...property, ownerRoomPlayerId: 'room-player-1' };
          }

          if (property.tileKey === TEST_BOARD_TILES.cheapPropertyPair) {
            return { ...property, ownerRoomPlayerId: 'room-player-2' };
          }

          return property;
        }),
      });

      const result = proposeTrade(state, {
        roomPlayerId: 'room-player-1',
        toRoomPlayerId: 'room-player-2',
        offeredCash: 60,
        requestedCash: 0,
        offeredPropertyKeys: [],
        requestedPropertyKeys: [TEST_BOARD_TILES.cheapPropertyPair],
      });

      expect(result.events.at(-1)?.type).toBe(expectedOutcome);
    },
  );
});
