import { getGameBoard } from './game-board';
import {
  type EndTurnInput,
  GameEngineError,
  type GameEnginePlayer,
  type GameEngineState,
  type RollAndMoveInput,
} from './game-engine.types';

export class GameEngineService {
  rollAndMove(
    state: GameEngineState,
    input: RollAndMoveInput,
  ): GameEngineState {
    this.assertCanRoll(state);
    this.assertCurrentTurn(state, input.roomPlayerId);
    this.assertValidDice(input.dice);

    const nextState = this.cloneState(state);
    const board = getGameBoard(nextState.boardKey);
    const steps = input.dice[0] + input.dice[1];
    const boardSize = board.tiles.length;

    const players = nextState.players.map((player) => {
      if (player.roomPlayerId !== input.roomPlayerId) {
        return player;
      }

      const nextAbsolutePosition = player.position + steps;
      const passedGo = nextAbsolutePosition >= boardSize;

      return {
        ...player,
        position: nextAbsolutePosition % boardSize,
        cash: passedGo ? player.cash + board.passGoCash : player.cash,
      };
    });

    return {
      ...nextState,
      phase: 'awaiting_turn_end',
      lastDiceRoll: [...input.dice],
      players,
    };
  }

  endTurn(state: GameEngineState, input: EndTurnInput): GameEngineState {
    this.assertCanEndTurn(state);
    this.assertCurrentTurn(state, input.roomPlayerId);

    const nextState = this.cloneState(state);
    const nextPlayer = this.findNextActivePlayer(nextState);

    return {
      ...nextState,
      phase: 'awaiting_roll',
      turnNumber: nextState.turnNumber + 1,
      currentTurnRoomPlayerId: nextPlayer.roomPlayerId,
      lastDiceRoll: null,
    };
  }

  private assertCanRoll(state: GameEngineState): void {
    this.assertGameActive(state);

    if (
      state.phase !== 'awaiting_first_turn' &&
      state.phase !== 'awaiting_roll'
    ) {
      throw new GameEngineError(
        'ROLL_NOT_ALLOWED',
        'Player cannot roll at this point in the turn',
      );
    }
  }

  private assertCanEndTurn(state: GameEngineState): void {
    this.assertGameActive(state);

    if (state.phase !== 'awaiting_turn_end') {
      throw new GameEngineError(
        'TURN_END_NOT_ALLOWED',
        'Player cannot end turn before completing an action',
      );
    }
  }

  private assertGameActive(state: GameEngineState): void {
    if (state.phase === 'finished' || state.phase === 'cancelled') {
      throw new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active');
    }
  }

  private assertCurrentTurn(
    state: GameEngineState,
    roomPlayerId: string,
  ): void {
    const player = state.players.find(
      (candidate) => candidate.roomPlayerId === roomPlayerId,
    );

    if (!player) {
      throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
    }

    if (player.bankrupt) {
      throw new GameEngineError(
        'PLAYER_NOT_FOUND',
        'Player is no longer active',
      );
    }

    if (state.currentTurnRoomPlayerId !== roomPlayerId) {
      throw new GameEngineError(
        'NOT_CURRENT_TURN',
        'It is not this player’s turn',
      );
    }
  }

  private assertValidDice(dice: readonly number[]): void {
    if (
      dice.length !== 2 ||
      dice.some((value) => !Number.isInteger(value) || value < 1 || value > 6)
    ) {
      throw new GameEngineError(
        'INVALID_DICE',
        'Dice roll must contain two values between 1 and 6',
      );
    }
  }

  private findNextActivePlayer(state: GameEngineState): GameEnginePlayer {
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

  private cloneState(state: GameEngineState): GameEngineState {
    return {
      ...state,
      lastDiceRoll: state.lastDiceRoll ? [...state.lastDiceRoll] : null,
      players: state.players.map((player) => this.clonePlayer(player)),
    };
  }

  private clonePlayer(player: GameEnginePlayer): GameEnginePlayer {
    return {
      ...player,
      properties: [...player.properties],
    };
  }
}
