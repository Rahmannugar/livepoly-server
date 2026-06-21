import { getGameBoard } from './game-board';
import type { GameTile, PropertyTile } from './game-board.types';
import { declareBankruptcy } from './game-engine-bankruptcy';
import { sellBuilding } from './game-engine-buildings';
import { payDebt } from './game-engine-debt';
import { mortgageProperty } from './game-engine-mortgage';
import {
  GameEngineError,
  type AutoResolveDebtInput,
  type GameEngineEvent,
  type GameEnginePlayer,
  type GameEngineProperty,
  type GameEngineResult,
  type GameEngineState,
} from './game-engine.types';

export function autoResolveDebt(
  state: GameEngineState,
  input: AutoResolveDebtInput,
): GameEngineResult {
  assertActiveDebt(state, input.roomPlayerId);

  let nextState = state;
  const events: GameEngineEvent[] = [];

  while (!canPayDebt(nextState, input.roomPlayerId)) {
    const building = findBuildingToSell(nextState, input.roomPlayerId);

    if (building) {
      const result = sellBuilding(nextState, {
        roomPlayerId: input.roomPlayerId,
        tileKey: building.tileKey,
      });
      nextState = result.state;
      events.push(...result.events);
      continue;
    }

    const mortgageableProperty = findPropertyToMortgage(
      nextState,
      input.roomPlayerId,
    );

    if (mortgageableProperty) {
      const result = mortgageProperty(nextState, {
        roomPlayerId: input.roomPlayerId,
        tileKey: mortgageableProperty.tileKey,
      });
      nextState = result.state;
      events.push(...result.events);
      continue;
    }

    break;
  }

  if (canPayDebt(nextState, input.roomPlayerId)) {
    const result = payDebt(nextState, input);

    return {
      state: result.state,
      events: [...events, ...result.events],
    };
  }

  const result = declareBankruptcy(nextState, {
    roomPlayerId: input.roomPlayerId,
    creditorRoomPlayerId: nextState.debt?.creditorRoomPlayerId,
  });

  return {
    state: result.state,
    events: [...events, ...result.events],
  };
}

function assertActiveDebt(state: GameEngineState, roomPlayerId: string): void {
  if (
    state.phase !== 'awaiting_debt_resolution' ||
    !state.debt ||
    state.debt.roomPlayerId !== roomPlayerId
  ) {
    throw new GameEngineError(
      'DEBT_RESOLUTION_REQUIRED',
      'Only the indebted player can automatically resolve this debt',
    );
  }
}

function canPayDebt(state: GameEngineState, roomPlayerId: string): boolean {
  const player = findPlayer(state, roomPlayerId);

  return Boolean(state.debt && player.cash >= state.debt.amount);
}

function findBuildingToSell(
  state: GameEngineState,
  roomPlayerId: string,
): GameEngineProperty | null {
  return (
    state.properties
      .filter(
        (property) =>
          property.ownerRoomPlayerId === roomPlayerId &&
          (property.hasHotel || property.houseCount > 0),
      )
      .sort((left, right) => {
        if (left.hasHotel !== right.hasHotel) {
          return left.hasHotel ? -1 : 1;
        }

        return right.houseCount - left.houseCount;
      })[0] ?? null
  );
}

function findPropertyToMortgage(
  state: GameEngineState,
  roomPlayerId: string,
): GameEngineProperty | null {
  const board = getGameBoard(state.boardKey);

  return (
    state.properties.find((property) => {
      if (
        property.ownerRoomPlayerId !== roomPlayerId ||
        property.mortgaged ||
        property.hasHotel ||
        property.houseCount > 0
      ) {
        return false;
      }

      const tile = board.tiles.find(
        (candidate) => candidate.key === property.tileKey,
      );

      return tile ? canMortgageTile(state, board.tiles, tile) : false;
    }) ?? null
  );
}

function canMortgageTile(
  state: GameEngineState,
  boardTiles: readonly GameTile[],
  tile: GameTile,
): boolean {
  if (tile.kind === 'airport' || tile.kind === 'utility') {
    return true;
  }

  if (tile.kind !== 'property') {
    return false;
  }

  const setTileKeys = boardTiles
    .filter(
      (candidate): candidate is PropertyTile =>
        candidate.kind === 'property' && candidate.setKey === tile.setKey,
    )
    .map((candidate) => candidate.key);

  return state.properties
    .filter((property) => setTileKeys.includes(property.tileKey))
    .every((property) => !property.hasHotel && property.houseCount === 0);
}

function findPlayer(
  state: GameEngineState,
  roomPlayerId: string,
): GameEnginePlayer {
  const player = state.players.find(
    (candidate) => candidate.roomPlayerId === roomPlayerId,
  );

  if (!player) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player does not exist');
  }

  return player;
}
