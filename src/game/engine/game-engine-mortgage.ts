import { getGameBoard } from './game-board';
import type {
  AirportTile,
  GameBoard,
  GameTile,
  PropertyTile,
  UtilityTile,
} from './game-board.types';
import { creditPlayer, debitPlayer } from './game-engine-money';
import {
  GameEngineError,
  type GameEngineProperty,
  type GameEngineResult,
  type GameEngineState,
  type MortgagePropertyInput,
  type UnmortgagePropertyInput,
} from './game-engine.types';
import { assertCurrentTurn } from './game-engine-assertions';

type MortgageableTile = PropertyTile | AirportTile | UtilityTile;

export function mortgageProperty(
  state: GameEngineState,
  input: MortgagePropertyInput,
): GameEngineResult {
  assertCanManageMortgage(state, input.roomPlayerId);

  const board = getGameBoard(state.boardKey);
  const tile = getMortgageableTileByKey(board, input.tileKey);
  const property = findPropertyState(state, tile.key);

  assertOwnedBy(property, input.roomPlayerId);

  if (property.mortgaged) {
    throw new GameEngineError(
      'PROPERTY_ALREADY_MORTGAGED',
      'Property is already mortgaged',
    );
  }

  assertNoBuildingsForMortgage(state, board, tile);

  const creditedState = creditPlayer(
    state,
    input.roomPlayerId,
    tile.mortgageValue,
  );

  return {
    state: updatePropertyState(creditedState, property.tileKey, {
      mortgaged: true,
    }),
    events: [
      {
        type: 'property_mortgaged',
        roomPlayerId: input.roomPlayerId,
        tileKey: property.tileKey,
        amount: tile.mortgageValue,
      },
    ],
  };
}

export function unmortgageProperty(
  state: GameEngineState,
  input: UnmortgagePropertyInput,
): GameEngineResult {
  assertCanManageMortgage(state, input.roomPlayerId);

  const board = getGameBoard(state.boardKey);
  const tile = getMortgageableTileByKey(board, input.tileKey);
  const property = findPropertyState(state, tile.key);

  assertOwnedBy(property, input.roomPlayerId);

  if (!property.mortgaged) {
    throw new GameEngineError(
      'PROPERTY_NOT_MORTGAGED',
      'Property is not mortgaged',
    );
  }

  const amount = getUnmortgageCost(tile.mortgageValue);
  const debitedState = debitPlayer(state, input.roomPlayerId, amount);

  return {
    state: updatePropertyState(debitedState, property.tileKey, {
      mortgaged: false,
    }),
    events: [
      {
        type: 'property_unmortgaged',
        roomPlayerId: input.roomPlayerId,
        tileKey: property.tileKey,
        amount,
      },
    ],
  };
}

function assertCanManageMortgage(
  state: GameEngineState,
  roomPlayerId: string,
): void {
  if (state.phase === 'finished' || state.phase === 'cancelled') {
    throw new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active');
  }

  if (state.phase !== 'awaiting_turn_end') {
    throw new GameEngineError(
      'MORTGAGE_NOT_ALLOWED',
      'Mortgage cannot be managed during this phase',
    );
  }

  assertCurrentTurn(state, roomPlayerId);
}

function assertOwnedBy(
  property: GameEngineProperty,
  roomPlayerId: string,
): void {
  if (property.ownerRoomPlayerId !== roomPlayerId) {
    throw new GameEngineError(
      'PROPERTY_NOT_OWNED',
      'Player does not own this property',
    );
  }
}

function assertNoBuildingsForMortgage(
  state: GameEngineState,
  board: GameBoard,
  tile: MortgageableTile,
): void {
  if (tile.kind !== 'property') {
    return;
  }

  const setTiles = board.tiles.filter(
    (candidate): candidate is PropertyTile =>
      candidate.kind === 'property' && candidate.setKey === tile.setKey,
  );

  const hasBuildingInSet = setTiles.some((setTile) => {
    const property = findPropertyState(state, setTile.key);

    return property.houseCount > 0 || property.hasHotel;
  });

  if (hasBuildingInSet) {
    throw new GameEngineError(
      'PROPERTY_HAS_BUILDINGS',
      'Buildings must be sold before mortgaging this set',
    );
  }
}

function getUnmortgageCost(mortgageValue: number): number {
  return Math.ceil(mortgageValue * 1.1);
}

function getMortgageableTileByKey(
  board: GameBoard,
  tileKey: string,
): MortgageableTile {
  const tile = board.tiles.find((candidate) => candidate.key === tileKey);

  if (!tile || !isMortgageableTile(tile)) {
    throw new GameEngineError(
      'MORTGAGE_NOT_ALLOWED',
      'Only ownable tiles can be mortgaged',
    );
  }

  return tile;
}

function isMortgageableTile(tile: GameTile): tile is MortgageableTile {
  return (
    tile.kind === 'property' ||
    tile.kind === 'airport' ||
    tile.kind === 'utility'
  );
}

function findPropertyState(
  state: GameEngineState,
  tileKey: string,
): GameEngineProperty {
  const property = state.properties.find(
    (candidate) => candidate.tileKey === tileKey,
  );

  if (!property) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile is not ownable');
  }

  return property;
}

function updatePropertyState(
  state: GameEngineState,
  tileKey: string,
  updates: Partial<GameEngineProperty>,
): GameEngineState {
  return {
    ...state,
    properties: state.properties.map((candidate) => {
      if (candidate.tileKey !== tileKey) {
        return candidate;
      }

      return {
        ...candidate,
        ...updates,
      };
    }),
  };
}
