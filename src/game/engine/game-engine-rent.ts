import { getGameBoard } from './game-board';
import type {
  AirportTile,
  PropertyTile,
  UtilityTile,
} from './game-board.types';
import { transferPlayerCash } from './game-engine-money';
import {
  GameEngineError,
  type GameEngineResult,
  type GameEngineState,
  type PayRentInput,
} from './game-engine.types';

type RentableTile = PropertyTile | AirportTile | UtilityTile;

export function payRent(
  state: GameEngineState,
  input: PayRentInput,
): GameEngineResult {
  const property = state.properties.find(
    (candidate) => candidate.tileKey === input.tileKey,
  );

  if (
    !property ||
    !property.ownerRoomPlayerId ||
    property.ownerRoomPlayerId === input.payerRoomPlayerId ||
    property.mortgaged
  ) {
    return {
      state,
      events: [],
    };
  }

  const board = getGameBoard(state.boardKey);
  const tile = board.tiles.find((candidate) => candidate.key === input.tileKey);

  if (!tile || !isRentableTile(tile)) {
    return {
      state,
      events: [],
    };
  }

  const amount = calculateRent(state, tile, input.dice);
  const nextState = transferPlayerCash(
    state,
    input.payerRoomPlayerId,
    property.ownerRoomPlayerId,
    amount,
  );

  return {
    state: nextState,
    events: [
      {
        type: 'rent_paid',
        payerRoomPlayerId: input.payerRoomPlayerId,
        ownerRoomPlayerId: property.ownerRoomPlayerId,
        tileKey: input.tileKey,
        amount,
      },
    ],
  };
}

export function calculateRent(
  state: GameEngineState,
  tile: RentableTile,
  dice: readonly [number, number],
): number {
  if (tile.kind === 'property') {
    const property = state.properties.find(
      (candidate) => candidate.tileKey === tile.key,
    );

    if (!property) {
      throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile cannot charge rent');
    }

    if (property.hasHotel) {
      return tile.hotelRent;
    }

    if (property.houseCount > 0) {
      return tile.rentByHouseCount[property.houseCount - 1];
    }

    if (ownsFullPropertySet(state, tile)) {
      return tile.baseRent * 2;
    }

    return tile.baseRent;
  }

  if (tile.kind === 'airport') {
    const ownedCount = countOwnedTilesByKind(state, 'airport', tile.key);

    return tile.rentByOwnedCount[ownedCount - 1] ?? tile.rentByOwnedCount[0];
  }

  const ownedCount = countOwnedTilesByKind(state, 'utility', tile.key);
  const multiplier =
    tile.rentMultiplierByOwnedCount[ownedCount - 1] ??
    tile.rentMultiplierByOwnedCount[0];

  return (dice[0] + dice[1]) * multiplier;
}

function ownsFullPropertySet(
  state: GameEngineState,
  tile: PropertyTile,
): boolean {
  const board = getGameBoard(state.boardKey);
  const property = state.properties.find(
    (candidate) => candidate.tileKey === tile.key,
  );

  if (!property?.ownerRoomPlayerId) {
    return false;
  }

  const setTiles = board.tiles.filter(
    (candidate): candidate is PropertyTile =>
      candidate.kind === 'property' && candidate.setKey === tile.setKey,
  );

  return setTiles.every((setTile) => {
    const setProperty = state.properties.find(
      (candidate) => candidate.tileKey === setTile.key,
    );

    return setProperty?.ownerRoomPlayerId === property.ownerRoomPlayerId;
  });
}

function countOwnedTilesByKind(
  state: GameEngineState,
  kind: 'airport' | 'utility',
  currentTileKey: string,
): number {
  const board = getGameBoard(state.boardKey);
  const property = state.properties.find(
    (candidate) => candidate.tileKey === currentTileKey,
  );

  if (!property?.ownerRoomPlayerId) {
    return 0;
  }

  return board.tiles
    .filter((tile) => tile.kind === kind)
    .filter((tile) => {
      const ownedProperty = state.properties.find(
        (candidate) => candidate.tileKey === tile.key,
      );

      return ownedProperty?.ownerRoomPlayerId === property.ownerRoomPlayerId;
    }).length;
}

function isRentableTile(tile: { kind: string }): tile is RentableTile {
  return (
    tile.kind === 'property' ||
    tile.kind === 'airport' ||
    tile.kind === 'utility'
  );
}
