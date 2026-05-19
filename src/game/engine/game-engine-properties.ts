import { getGameBoard } from './game-board';
import type {
  AirportTile,
  GameBoard,
  GameTile,
  PropertyTile,
  UtilityTile,
} from './game-board.types';
import { debitPlayer } from './game-engine-money';
import {
  GameEngineError,
  type BuyPropertyInput,
  type GameEngineProperty,
  type GameEngineResult,
  type GameEngineState,
  type OwnableTileKind,
} from './game-engine.types';

type OwnableTile = PropertyTile | AirportTile | UtilityTile;

const OWNABLE_TILE_KINDS: readonly OwnableTileKind[] = [
  'property',
  'airport',
  'utility',
];

export function createInitialPropertyState(
  state: Pick<GameEngineState, 'boardKey'>,
): GameEngineProperty[] {
  const board = getGameBoard(state.boardKey);

  return board.tiles
    .filter((tile): tile is OwnableTile =>
      OWNABLE_TILE_KINDS.includes(tile.kind as OwnableTileKind),
    )
    .map((tile) => ({
      tileKey: tile.key,
      ownerRoomPlayerId: null,
      houseCount: 0,
      hasHotel: false,
      mortgaged: false,
    }));
}

export function buyProperty(
  state: GameEngineState,
  input: BuyPropertyInput,
): GameEngineResult {
  const tileKey = state.pendingTileKey;

  if (!tileKey) {
    throw new GameEngineError(
      'NO_PROPERTY_DECISION',
      'There is no property decision to resolve',
    );
  }

  const board = getGameBoard(state.boardKey);
  const tile = getTileByKey(board, tileKey);

  if (!isOwnableTile(tile)) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile cannot be bought');
  }

  const property = findPropertyState(state, tile.key);

  if (property.ownerRoomPlayerId) {
    throw new GameEngineError(
      'PROPERTY_ALREADY_OWNED',
      'Property is already owned',
    );
  }

  const nextState = debitPlayer(state, input.roomPlayerId, tile.price);

  return {
    state: {
      ...nextState,
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
      properties: nextState.properties.map((candidate) => {
        if (candidate.tileKey !== tile.key) {
          return candidate;
        }

        return {
          ...candidate,
          ownerRoomPlayerId: input.roomPlayerId,
        };
      }),
    },
    events: [
      {
        type: 'property_bought',
        roomPlayerId: input.roomPlayerId,
        tileKey: tile.key,
        amount: tile.price,
      },
    ],
  };
}

export function isOwnableTile(tile: GameTile): tile is OwnableTile {
  return OWNABLE_TILE_KINDS.includes(tile.kind as OwnableTileKind);
}

function findPropertyState(
  state: GameEngineState,
  tileKey: string,
): GameEngineProperty {
  const property = state.properties.find(
    (candidate) => candidate.tileKey === tileKey,
  );

  if (!property) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile cannot be bought');
  }

  return property;
}

function getTileByKey(board: GameBoard, tileKey: string): GameTile {
  const tile = board.tiles.find((candidate) => candidate.key === tileKey);

  if (!tile) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile cannot be bought');
  }

  return tile;
}
