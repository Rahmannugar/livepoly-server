import { getGameBoard } from './game-board';
import type { GameBoard, GameTile, PropertyTile } from './game-board.types';
import { creditPlayer, debitPlayer } from './game-engine-money';
import {
  GameEngineError,
  type BuildPropertyInput,
  type GameEngineProperty,
  type GameEngineResult,
  type GameEngineState,
  type SellBuildingInput,
} from './game-engine.types';

export function buildProperty(
  state: GameEngineState,
  input: BuildPropertyInput,
): GameEngineResult {
  assertCanManageBuildings(state);

  const board = getGameBoard(state.boardKey);
  const tile = getPropertyTileByKey(board, input.tileKey);
  const setProperties = getOwnedSetProperties(
    state,
    board,
    tile,
    input.roomPlayerId,
  );
  const property = findPropertyState(state, tile.key);

  assertSetIsNotMortgaged(setProperties);

  if (property.hasHotel) {
    throw new GameEngineError(
      'BUILDING_LIMIT_REACHED',
      'Property already has a hotel',
    );
  }

  if (property.houseCount < 4) {
    assertCanBuildHouseEvenly(property, setProperties);

    const debitedState = debitPlayer(state, input.roomPlayerId, tile.houseCost);
    const nextHouseCount = property.houseCount + 1;

    return {
      state: updatePropertyState(debitedState, property.tileKey, {
        houseCount: nextHouseCount,
      }),
      events: [
        {
          type: 'property_house_built',
          roomPlayerId: input.roomPlayerId,
          tileKey: property.tileKey,
          houseCount: nextHouseCount,
          amount: tile.houseCost,
        },
      ],
    };
  }

  assertCanBuildHotelEvenly(property, setProperties);

  const debitedState = debitPlayer(state, input.roomPlayerId, tile.houseCost);

  return {
    state: updatePropertyState(debitedState, property.tileKey, {
      houseCount: 0,
      hasHotel: true,
    }),
    events: [
      {
        type: 'property_hotel_built',
        roomPlayerId: input.roomPlayerId,
        tileKey: property.tileKey,
        amount: tile.houseCost,
      },
    ],
  };
}

export function sellBuilding(
  state: GameEngineState,
  input: SellBuildingInput,
): GameEngineResult {
  assertCanManageBuildings(state);

  const board = getGameBoard(state.boardKey);
  const tile = getPropertyTileByKey(board, input.tileKey);
  const setProperties = getOwnedSetProperties(
    state,
    board,
    tile,
    input.roomPlayerId,
  );
  const property = findPropertyState(state, tile.key);
  const sellAmount = tile.houseCost / 2;

  if (property.hasHotel) {
    const creditedState = creditPlayer(state, input.roomPlayerId, sellAmount);

    return {
      state: updatePropertyState(creditedState, property.tileKey, {
        houseCount: 4,
        hasHotel: false,
      }),
      events: [
        {
          type: 'property_hotel_sold',
          roomPlayerId: input.roomPlayerId,
          tileKey: property.tileKey,
          amount: sellAmount,
        },
      ],
    };
  }

  if (property.houseCount === 0) {
    throw new GameEngineError(
      'NO_BUILDING_TO_SELL',
      'Property has no building to sell',
    );
  }

  assertCanSellHouseEvenly(property, setProperties);

  const creditedState = creditPlayer(state, input.roomPlayerId, sellAmount);
  const nextHouseCount = property.houseCount - 1;

  return {
    state: updatePropertyState(creditedState, property.tileKey, {
      houseCount: nextHouseCount,
    }),
    events: [
      {
        type: 'property_house_sold',
        roomPlayerId: input.roomPlayerId,
        tileKey: property.tileKey,
        houseCount: nextHouseCount,
        amount: sellAmount,
      },
    ],
  };
}

function assertCanManageBuildings(state: GameEngineState): void {
  if (state.phase === 'finished' || state.phase === 'cancelled') {
    throw new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active');
  }

  if (
    state.phase === 'awaiting_property_decision' ||
    state.phase === 'awaiting_auction_bid'
  ) {
    throw new GameEngineError(
      'BUILDING_NOT_ALLOWED',
      'Buildings cannot be managed during this phase',
    );
  }
}

function assertCanBuildHouseEvenly(
  property: GameEngineProperty,
  setProperties: GameEngineProperty[],
): void {
  const nonHotelHouseCounts = setProperties
    .filter((candidate) => !candidate.hasHotel)
    .map((candidate) => candidate.houseCount);

  const lowestHouseCount = Math.min(...nonHotelHouseCounts);

  if (property.houseCount !== lowestHouseCount) {
    throw new GameEngineError(
      'UNEVEN_BUILDING',
      'Houses must be built evenly across the set',
    );
  }
}

function assertCanBuildHotelEvenly(
  property: GameEngineProperty,
  setProperties: GameEngineProperty[],
): void {
  if (property.houseCount !== 4) {
    throw new GameEngineError(
      'BUILDING_LIMIT_REACHED',
      'Property must have four houses before a hotel',
    );
  }

  const canUpgradeToHotel = setProperties.every((candidate) => {
    if (candidate.tileKey === property.tileKey) {
      return candidate.houseCount === 4 && !candidate.hasHotel;
    }

    return candidate.hasHotel || candidate.houseCount === 4;
  });

  if (!canUpgradeToHotel) {
    throw new GameEngineError(
      'UNEVEN_BUILDING',
      'Hotels must be built evenly across the set',
    );
  }
}

function assertCanSellHouseEvenly(
  property: GameEngineProperty,
  setProperties: GameEngineProperty[],
): void {
  const hasHotelInSet = setProperties.some((candidate) => candidate.hasHotel);

  if (hasHotelInSet) {
    throw new GameEngineError(
      'UNEVEN_BUILDING',
      'Hotels must be sold before houses',
    );
  }

  const highestHouseCount = Math.max(
    ...setProperties.map((candidate) => candidate.houseCount),
  );

  if (property.houseCount !== highestHouseCount) {
    throw new GameEngineError(
      'UNEVEN_BUILDING',
      'Houses must be sold evenly across the set',
    );
  }
}

function assertSetIsNotMortgaged(setProperties: GameEngineProperty[]): void {
  if (setProperties.some((property) => property.mortgaged)) {
    throw new GameEngineError(
      'PROPERTY_MORTGAGED',
      'Buildings cannot be managed while the set has a mortgage',
    );
  }
}

function getOwnedSetProperties(
  state: GameEngineState,
  board: GameBoard,
  tile: PropertyTile,
  roomPlayerId: string,
): GameEngineProperty[] {
  const setTiles = board.tiles.filter(
    (candidate): candidate is PropertyTile =>
      candidate.kind === 'property' && candidate.setKey === tile.setKey,
  );

  const setProperties = setTiles.map((setTile) =>
    findPropertyState(state, setTile.key),
  );

  if (
    setProperties.some(
      (property) => property.ownerRoomPlayerId !== roomPlayerId,
    )
  ) {
    throw new GameEngineError(
      'PROPERTY_SET_NOT_OWNED',
      'Player does not own the full property set',
    );
  }

  return setProperties;
}

function getPropertyTileByKey(board: GameBoard, tileKey: string): PropertyTile {
  const tile = board.tiles.find((candidate) => candidate.key === tileKey);

  if (!tile || tile.kind !== 'property') {
    throw new GameEngineError(
      'BUILDING_NOT_ALLOWED',
      'Buildings can only be managed on property tiles',
    );
  }

  return tile;
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
