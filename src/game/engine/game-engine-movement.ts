import { getGameBoard, getTile } from './game-board';
import { cloneDiceRoll } from './game-engine-cloner';
import { isOwnableTile } from './game-engine-properties';
import { payRent } from './game-engine-rent';
import {
  GameEngineError,
  type GameEngineEvent,
  type GameEngineResult,
  type GameEngineState,
  type RollAndMoveInput,
} from './game-engine.types';

export function rollAndMove(
  state: GameEngineState,
  input: RollAndMoveInput,
): GameEngineResult {
  const board = getGameBoard(state.boardKey);
  const steps = input.dice[0] + input.dice[1];
  const boardSize = board.tiles.length;
  const events: GameEngineEvent[] = [];
  let landedTileKey: string | null = null;
  let landedTileIsOwnableAndUnowned = false;

  const players = state.players.map((player) => {
    if (player.roomPlayerId !== input.roomPlayerId) {
      return player;
    }

    const fromPosition = player.position;
    const nextAbsolutePosition = fromPosition + steps;
    const passedGo = nextAbsolutePosition >= boardSize;
    const toPosition = nextAbsolutePosition % boardSize;
    const landedTile = getTile(board, toPosition);
    const property = state.properties.find(
      (candidate) => candidate.tileKey === landedTile.key,
    );

    landedTileKey = landedTile.key;
    landedTileIsOwnableAndUnowned =
      isOwnableTile(landedTile) && !!property && !property.ownerRoomPlayerId;

    events.push({
      type: 'player_moved',
      roomPlayerId: input.roomPlayerId,
      fromPosition,
      toPosition,
      dice: cloneDiceRoll(input.dice),
    });

    if (passedGo) {
      events.push({
        type: 'player_passed_go',
        roomPlayerId: input.roomPlayerId,
        amount: board.passGoCash,
      });
    }

    events.push({
      type: 'player_landed_on_tile',
      roomPlayerId: input.roomPlayerId,
      tileKey: landedTile.key,
      tileKind: landedTile.kind,
    });

    return {
      ...player,
      position: toPosition,
      cash: passedGo ? player.cash + board.passGoCash : player.cash,
    };
  });

  if (!landedTileKey) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
  }

  const movedState: GameEngineState = {
    ...state,
    phase: landedTileIsOwnableAndUnowned
      ? 'awaiting_property_decision'
      : 'awaiting_turn_end',
    pendingTileKey: landedTileIsOwnableAndUnowned ? landedTileKey : null,
    lastDiceRoll: cloneDiceRoll(input.dice),
    players,
  };

  if (landedTileIsOwnableAndUnowned) {
    return {
      state: movedState,
      events,
    };
  }

  const rentResult = payRent(movedState, {
    payerRoomPlayerId: input.roomPlayerId,
    tileKey: landedTileKey,
    dice: input.dice,
  });

  return {
    state: rentResult.state,
    events: [...events, ...rentResult.events],
  };
}
