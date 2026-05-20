import { endTurn, findNextActivePlayer } from '../game-engine-turns';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-turns', () => {
  it('finds next player by seat order', () => {
    const state = createGameEngineState();

    const result = findNextActivePlayer(state);

    expect(result.roomPlayerId).toBe('room-player-2');
  });

  it('skips bankrupt players', () => {
    const state = createGameEngineState();
    state.players[1].bankrupt = true;

    const result = findNextActivePlayer(state);

    expect(result.roomPlayerId).toBe('room-player-3');
  });

  it('ends current turn', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
    });

    const result = endTurn(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_roll',
      turnNumber: 2,
      currentTurnRoomPlayerId: 'room-player-2',
      lastDiceRoll: null,
    });
    expect(result.events).toEqual([
      {
        type: 'turn_ended',
        roomPlayerId: 'room-player-1',
        nextRoomPlayerId: 'room-player-2',
        turnNumber: 2,
      },
    ]);
  });

  it('throws when there are no active players', () => {
    const state = createGameEngineState({
      players: [
        createGameEngineState().players[0],
        createGameEngineState().players[1],
      ],
    });

    state.players[0].bankrupt = true;
    state.players[1].bankrupt = true;

    expect(() => findNextActivePlayer(state)).toThrow(
      new GameEngineError('NO_ACTIVE_PLAYERS', 'Game has no active players'),
    );
  });
});
