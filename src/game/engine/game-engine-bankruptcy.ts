import {
  GameEngineError,
  type DeclareBankruptcyInput,
  type GameEnginePlayer,
  type GameEngineProperty,
  type GameEngineResult,
  type GameEngineState,
} from './game-engine.types';

export function declareBankruptcy(
  state: GameEngineState,
  input: DeclareBankruptcyInput,
): GameEngineResult {
  assertCanDeclareBankruptcy(state);

  const bankruptPlayer = findPlayer(state, input.roomPlayerId);

  if (bankruptPlayer.bankrupt) {
    throw new GameEngineError(
      'PLAYER_ALREADY_BANKRUPT',
      'Player is already bankrupt',
    );
  }

  if (input.creditorRoomPlayerId) {
    assertValidCreditor(state, input);
  }

  const liquidatedState = liquidatePlayerAssets(state, input);
  const activePlayersAfterBankruptcy = getActivePlayers(liquidatedState);

  if (activePlayersAfterBankruptcy.length <= 1) {
    return {
      state: {
        ...liquidatedState,
        phase: 'finished',
        currentTurnRoomPlayerId:
          activePlayersAfterBankruptcy[0]?.roomPlayerId ??
          liquidatedState.currentTurnRoomPlayerId,
        shouldCurrentPlayerPlayAgain: false,
        consecutiveDoublesCount: 0,
        auction: null,
        pendingTileKey: null,
      },
      events: [
        {
          type: 'player_bankrupt',
          roomPlayerId: input.roomPlayerId,
          creditorRoomPlayerId: input.creditorRoomPlayerId ?? null,
        },
        {
          type: 'game_finished_by_bankruptcy',
          winnerRoomPlayerId:
            activePlayersAfterBankruptcy[0]?.roomPlayerId ?? null,
        },
      ],
    };
  }

  if (state.currentTurnRoomPlayerId !== input.roomPlayerId) {
    return {
      state: liquidatedState,
      events: [
        {
          type: 'player_bankrupt',
          roomPlayerId: input.roomPlayerId,
          creditorRoomPlayerId: input.creditorRoomPlayerId ?? null,
        },
      ],
    };
  }

  const nextPlayer = findNextActivePlayerAfterBankruptcy(
    liquidatedState,
    bankruptPlayer,
  );
  const nextTurnNumber = liquidatedState.turnNumber + 1;

  return {
    state: {
      ...liquidatedState,
      phase: 'awaiting_roll',
      currentTurnRoomPlayerId: nextPlayer.roomPlayerId,
      turnNumber: nextTurnNumber,
      shouldCurrentPlayerPlayAgain: false,
      consecutiveDoublesCount: 0,
      lastDiceRoll: null,
      auction: null,
      pendingTileKey: null,
    },
    events: [
      {
        type: 'player_bankrupt',
        roomPlayerId: input.roomPlayerId,
        creditorRoomPlayerId: input.creditorRoomPlayerId ?? null,
      },
      {
        type: 'turn_ended',
        roomPlayerId: input.roomPlayerId,
        nextRoomPlayerId: nextPlayer.roomPlayerId,
        turnNumber: nextTurnNumber,
      },
    ],
  };
}

function assertCanDeclareBankruptcy(state: GameEngineState): void {
  if (state.phase === 'finished' || state.phase === 'cancelled') {
    throw new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active');
  }
}

function assertValidCreditor(
  state: GameEngineState,
  input: DeclareBankruptcyInput,
): void {
  const creditor = findPlayer(state, input.creditorRoomPlayerId as string);

  if (creditor.bankrupt) {
    throw new GameEngineError(
      'INVALID_BANKRUPTCY_CREDITOR',
      'Bankruptcy creditor is not active',
    );
  }

  if (creditor.roomPlayerId === input.roomPlayerId) {
    throw new GameEngineError(
      'INVALID_BANKRUPTCY_CREDITOR',
      'Player cannot owe bankruptcy to self',
    );
  }
}

function liquidatePlayerAssets(
  state: GameEngineState,
  input: DeclareBankruptcyInput,
): GameEngineState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.roomPlayerId !== input.roomPlayerId) {
        return player;
      }

      return {
        ...player,
        cash: 0,
        inJail: false,
        jailTurnCount: 0,
        getOutOfJailFreeCards: 0,
        bankrupt: true,
      };
    }),
    properties: state.properties.map((property) =>
      liquidateProperty(property, input),
    ),
  };
}

function liquidateProperty(
  property: GameEngineProperty,
  input: DeclareBankruptcyInput,
): GameEngineProperty {
  if (property.ownerRoomPlayerId !== input.roomPlayerId) {
    return property;
  }

  return {
    ...property,
    ownerRoomPlayerId: input.creditorRoomPlayerId ?? null,
    houseCount: 0,
    hasHotel: false,
    mortgaged: false,
  };
}

function findNextActivePlayerAfterBankruptcy(
  state: GameEngineState,
  bankruptPlayer: GameEnginePlayer,
): GameEnginePlayer {
  const activePlayers = getActivePlayers(state);

  const nextPlayer = activePlayers.find(
    (player) => player.seatNumber > bankruptPlayer.seatNumber,
  );

  return nextPlayer ?? activePlayers[0];
}

function getActivePlayers(state: GameEngineState): GameEnginePlayer[] {
  return state.players
    .filter((player) => !player.bankrupt)
    .sort((left, right) => left.seatNumber - right.seatNumber);
}

function findPlayer(
  state: GameEngineState,
  roomPlayerId: string,
): GameEnginePlayer {
  const player = state.players.find(
    (candidate) => candidate.roomPlayerId === roomPlayerId,
  );

  if (!player) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
  }

  return player;
}
