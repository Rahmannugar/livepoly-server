import {
  calculateNetWorthStandings,
  getNetWorthWinners,
} from './game-engine-derived-state';
import { returnGetOutOfJailCardToDeck } from './game-engine-cards';
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

  const creditorRoomPlayerId =
    input.creditorRoomPlayerId ??
    (state.debt?.roomPlayerId === input.roomPlayerId
      ? state.debt.creditorRoomPlayerId
      : null);

  if (creditorRoomPlayerId) {
    assertValidCreditor(state, {
      ...input,
      creditorRoomPlayerId,
    });
  }
  const liquidatedState = liquidatePlayerAssets(state, {
    ...input,
    creditorRoomPlayerId,
  });
  const activePlayersAfterBankruptcy = getActivePlayers(liquidatedState);

  if (
    activePlayersAfterBankruptcy.length <= 1 ||
    hasNoActiveHumanPlayers(activePlayersAfterBankruptcy)
  ) {
    const standings = calculateNetWorthStandings(liquidatedState);
    const winners = getNetWorthWinners(standings);

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
        tradeOffer: null,
        debt: null,
        pendingTileKey: null,
      },
      events: [
        {
          type: 'player_bankrupt',
          roomPlayerId: input.roomPlayerId,
          creditorRoomPlayerId,
        },
        {
          type: 'game_finished_by_bankruptcy',
          winnerRoomPlayerId:
            winners.length === 1 ? winners[0].roomPlayerId : null,
          tiedRoomPlayerIds: winners.map((winner) => winner.roomPlayerId),
          standings,
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
          creditorRoomPlayerId,
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
        creditorRoomPlayerId,
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
  const bankruptPlayer = findPlayer(state, input.roomPlayerId);
  const heldCardKeys = bankruptPlayer.getOutOfJailFreeCardKeys?.length
    ? bankruptPlayer.getOutOfJailFreeCardKeys
    : Array.from(
        { length: bankruptPlayer.getOutOfJailFreeCards },
        () => 'chance_get_out_of_jail_free',
      );
  const stateWithReturnedCards = heldCardKeys.reduce(
    (currentState, cardKey) =>
      returnGetOutOfJailCardToDeck(currentState, cardKey),
    state,
  );

  return {
    ...stateWithReturnedCards,
    players: stateWithReturnedCards.players.map((player) => {
      if (player.roomPlayerId !== input.roomPlayerId) {
        return player;
      }

      return {
        ...player,
        cash: 0,
        inJail: false,
        jailTurnCount: 0,
        getOutOfJailFreeCards: 0,
        getOutOfJailFreeCardKeys: [],
        bankrupt: true,
      };
    }),
    properties: stateWithReturnedCards.properties.map((property) =>
      liquidateProperty(property, input),
    ),
    debt:
      stateWithReturnedCards.debt?.roomPlayerId === input.roomPlayerId
        ? null
        : stateWithReturnedCards.debt,
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

function hasNoActiveHumanPlayers(players: GameEnginePlayer[]): boolean {
  return !players.some((player) => player.playerType === 'human');
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
