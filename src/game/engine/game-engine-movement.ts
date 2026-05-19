import { getGameBoard, getTile } from './game-board';
import { drawAndApplyCard } from './game-engine-cards';
import { cloneDiceRoll } from './game-engine-cloner';
import {
  applyDoublesState,
  isDoubles,
  isThirdConsecutiveDoubles,
} from './game-engine-dice';
import { resolveJailedRoll, sendPlayerToJail } from './game-engine-jail';
import { isOwnableTile } from './game-engine-properties';
import { payRent } from './game-engine-rent';
import {
  GameEngineError,
  type GameCardDeckKey,
  type GameEngineEvent,
  type GameEngineResult,
  type GameEngineState,
  type RollAndMoveInput,
} from './game-engine.types';

export function rollAndMove(
  state: GameEngineState,
  input: RollAndMoveInput,
): GameEngineResult {
  const jailedRollResult = resolveJailedRoll(state, {
    roomPlayerId: input.roomPlayerId,
    dice: input.dice,
    moveReleasedPlayer: (releasedState) =>
      rollAndMoveIgnoringJail(releasedState, input, {
        suppressDoubles: true,
      }),
  });

  if (jailedRollResult) {
    return jailedRollResult;
  }

  return rollAndMoveIgnoringJail(state, input);
}

function rollAndMoveIgnoringJail(
  state: GameEngineState,
  input: RollAndMoveInput,
  options: { suppressDoubles?: boolean } = {},
): GameEngineResult {
  if (
    !options.suppressDoubles &&
    isThirdConsecutiveDoubles(state, input.dice)
  ) {
    const doublesState = applyDoublesState(state, input.dice);
    const jailResult = sendPlayerToJail(doublesState, input.roomPlayerId);

    return {
      state: {
        ...jailResult.state,
        lastDiceRoll: cloneDiceRoll(input.dice),
        consecutiveDoublesCount: 0,
        shouldCurrentPlayerPlayAgain: false,
      },
      events: [
        {
          type: 'player_rolled_doubles',
          roomPlayerId: input.roomPlayerId,
          consecutiveDoublesCount: 3,
        },
        {
          type: 'player_rolled_third_doubles',
          roomPlayerId: input.roomPlayerId,
        },
        ...jailResult.events,
      ],
    };
  }

  const board = getGameBoard(state.boardKey);
  const steps = input.dice[0] + input.dice[1];
  const boardSize = board.tiles.length;
  const events: GameEngineEvent[] = [];
  let landedTileKey: string | null = null;
  let landedTileKind: string | null = null;
  let landedTileIsOwnableAndUnowned = false;
  let landedOnGoToJail = false;

  const doublesState = options.suppressDoubles
    ? {
        ...state,
        consecutiveDoublesCount: 0,
        shouldCurrentPlayerPlayAgain: false,
      }
    : applyDoublesState(state, input.dice);

  if (!options.suppressDoubles && isDoubles(input.dice)) {
    events.push({
      type: 'player_rolled_doubles',
      roomPlayerId: input.roomPlayerId,
      consecutiveDoublesCount: doublesState.consecutiveDoublesCount,
    });
  }

  const players = doublesState.players.map((player) => {
    if (player.roomPlayerId !== input.roomPlayerId) {
      return player;
    }

    const fromPosition = player.position;
    const nextAbsolutePosition = fromPosition + steps;
    const passedGo = nextAbsolutePosition >= boardSize;
    const toPosition = nextAbsolutePosition % boardSize;
    const landedTile = getTile(board, toPosition);
    const property = doublesState.properties.find(
      (candidate) => candidate.tileKey === landedTile.key,
    );

    landedTileKey = landedTile.key;
    landedTileKind = landedTile.kind;
    landedOnGoToJail = landedTile.kind === 'go_to_jail';
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

  if (!landedTileKey || !landedTileKind) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
  }

  const movedState: GameEngineState = {
    ...doublesState,
    phase: landedTileIsOwnableAndUnowned
      ? 'awaiting_property_decision'
      : 'awaiting_turn_end',
    pendingTileKey: landedTileIsOwnableAndUnowned ? landedTileKey : null,
    lastDiceRoll: cloneDiceRoll(input.dice),
    players,
  };

  if (landedOnGoToJail) {
    const jailResult = sendPlayerToJail(movedState, input.roomPlayerId);

    return {
      state: {
        ...jailResult.state,
        consecutiveDoublesCount: 0,
        shouldCurrentPlayerPlayAgain: false,
      },
      events: [...events, ...jailResult.events],
    };
  }

  if (landedTileKind === 'chance' || landedTileKind === 'world_fund') {
    const cardResult = drawAndApplyCard(movedState, {
      roomPlayerId: input.roomPlayerId,
      deckKey: landedTileKind as GameCardDeckKey,
    });

    return {
      state: cardResult.state,
      events: [...events, ...cardResult.events],
    };
  }

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
