import {
  GameEngineError,
  type EndTurnInput,
  type GameEnginePlayer,
  type GameEngineResult,
  type GameEngineState,
} from './game-engine.types';

export function endTurn(
  state: GameEngineState,
  input: EndTurnInput,
): GameEngineResult {
  if (state.shouldCurrentPlayerPlayAgain) {
    return {
      state: {
        ...state,
        phase: 'awaiting_roll',
        lastDiceRoll: null,
        shouldCurrentPlayerPlayAgain: false,
      },
      events: [
        {
          type: 'turn_ended',
          roomPlayerId: input.roomPlayerId,
          nextRoomPlayerId: input.roomPlayerId,
          turnNumber: state.turnNumber,
        },
      ],
    };
  }

  const nextPlayer = findNextActivePlayer(state);
  const nextTurnNumber = state.turnNumber + 1;

  return {
    state: {
      ...state,
      phase: 'awaiting_roll',
      turnNumber: nextTurnNumber,
      currentTurnRoomPlayerId: nextPlayer.roomPlayerId,
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
      lastDiceRoll: null,
    },
    events: [
      {
        type: 'turn_ended',
        roomPlayerId: input.roomPlayerId,
        nextRoomPlayerId: nextPlayer.roomPlayerId,
        turnNumber: nextTurnNumber,
      },
    ],
  };
}

export function findNextActivePlayer(state: GameEngineState): GameEnginePlayer {
  const activePlayers = state.players
    .filter((player) => !player.bankrupt)
    .sort((left, right) => left.seatNumber - right.seatNumber);

  if (activePlayers.length === 0) {
    throw new GameEngineError(
      'NO_ACTIVE_PLAYERS',
      'Game has no active players',
    );
  }

  const currentIndex = activePlayers.findIndex(
    (player) => player.roomPlayerId === state.currentTurnRoomPlayerId,
  );

  if (currentIndex === -1) {
    throw new GameEngineError(
      'PLAYER_NOT_FOUND',
      'Current turn player is not active',
    );
  }

  return activePlayers[(currentIndex + 1) % activePlayers.length];
}
