import { GameEngineService } from './game-engine.service';
import { GameEngineError, type GameEngineState } from './game-engine.types';

describe('GameEngineService', () => {
  let service: GameEngineService;

  const baseState = (): GameEngineState => ({
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'ranked',
    phase: 'awaiting_first_turn',
    turnNumber: 1,
    currentTurnRoomPlayerId: 'room-player-1',
    lastDiceRoll: null,
    players: [
      {
        roomPlayerId: 'room-player-1',
        userId: 'user-1',
        username: 'playerone',
        playerType: 'human',
        botDifficulty: null,
        botName: null,
        seatNumber: 1,
        cash: 1500,
        position: 0,
        properties: [],
        inJail: false,
        bankrupt: false,
      },
      {
        roomPlayerId: 'room-player-2',
        userId: 'user-2',
        username: 'playertwo',
        playerType: 'human',
        botDifficulty: null,
        botName: null,
        seatNumber: 2,
        cash: 1500,
        position: 0,
        properties: [],
        inJail: false,
        bankrupt: false,
      },
      {
        roomPlayerId: 'room-player-3',
        userId: 'user-3',
        username: 'playerthree',
        playerType: 'human',
        botDifficulty: null,
        botName: null,
        seatNumber: 3,
        cash: 1500,
        position: 0,
        properties: [],
        inJail: false,
        bankrupt: false,
      },
    ],
  });

  beforeEach(() => {
    service = new GameEngineService();
  });

  it('moves the current player and waits for turn end', () => {
    const result = service.rollAndMove(baseState(), {
      roomPlayerId: 'room-player-1',
      dice: [3, 4],
    });

    expect(result.phase).toBe('awaiting_turn_end');
    expect(result.lastDiceRoll).toEqual([3, 4]);
    expect(result.players[0]).toMatchObject({
      roomPlayerId: 'room-player-1',
      position: 7,
      cash: 1500,
    });
  });

  it('pays the player when passing go', () => {
    const state = baseState();
    state.players[0].position = 38;

    const result = service.rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [3, 2],
    });

    expect(result.players[0]).toMatchObject({
      position: 3,
      cash: 1700,
    });
  });

  it('rejects a roll from a player whose turn has not started', () => {
    expect(() =>
      service.rollAndMove(baseState(), {
        roomPlayerId: 'room-player-2',
        dice: [1, 2],
      }),
    ).toThrow(
      new GameEngineError('NOT_CURRENT_TURN', 'It is not this player’s turn'),
    );
  });

  it('rejects invalid dice values', () => {
    expect(() =>
      service.rollAndMove(baseState(), {
        roomPlayerId: 'room-player-1',
        dice: [0, 7],
      }),
    ).toThrow(
      new GameEngineError(
        'INVALID_DICE',
        'Dice roll must contain two values between 1 and 6',
      ),
    );
  });

  it('advances turn by seat order after a completed move', () => {
    const movedState = service.rollAndMove(baseState(), {
      roomPlayerId: 'room-player-1',
      dice: [2, 2],
    });

    const result = service.endTurn(movedState, {
      roomPlayerId: 'room-player-1',
    });

    expect(result).toMatchObject({
      phase: 'awaiting_roll',
      turnNumber: 2,
      currentTurnRoomPlayerId: 'room-player-2',
      lastDiceRoll: null,
    });
  });

  it('skips bankrupt players when advancing turn', () => {
    const state = baseState();
    state.players[1].bankrupt = true;

    const movedState = service.rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [1, 1],
    });

    const result = service.endTurn(movedState, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.currentTurnRoomPlayerId).toBe('room-player-3');
  });

  it('rejects ending turn before rolling', () => {
    expect(() =>
      service.endTurn(baseState(), {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(
      new GameEngineError(
        'TURN_END_NOT_ALLOWED',
        'Player cannot end turn before completing an action',
      ),
    );
  });
});
