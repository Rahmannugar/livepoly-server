import { getGameBoard } from './game-board';
import type {
  AirportTile,
  GameBoard,
  GameTile,
  PropertyTile,
  UtilityTile,
} from './game-board.types';
import {
  GameEngineError,
  type GameEnginePlayer,
  type GameEngineProperty,
  type GameEngineState,
  type PlayerNetWorth,
} from './game-engine.types';

type AssetTile = PropertyTile | AirportTile | UtilityTile;

export function getActivePlayers(state: GameEngineState): GameEnginePlayer[] {
  return state.players
    .filter((player) => !player.bankrupt)
    .sort((left, right) => left.seatNumber - right.seatNumber);
}

export function getPlayerByRoomPlayerId(
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

export function getPropertyByTileKey(
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

export function getTileOwnerRoomPlayerId(
  state: GameEngineState,
  tileKey: string,
): string | null {
  return getPropertyByTileKey(state, tileKey).ownerRoomPlayerId;
}

export function getOwnedProperties(
  state: GameEngineState,
  roomPlayerId: string,
): GameEngineProperty[] {
  getPlayerByRoomPlayerId(state, roomPlayerId);

  return state.properties.filter(
    (property) => property.ownerRoomPlayerId === roomPlayerId,
  );
}

export function canPlayerAct(
  state: GameEngineState,
  roomPlayerId: string,
): boolean {
  if (isGameTerminal(state)) {
    return false;
  }

  const player = getPlayerByRoomPlayerId(state, roomPlayerId);

  return (
    !player.bankrupt && state.currentTurnRoomPlayerId === player.roomPlayerId
  );
}

export function isGameTerminal(state: GameEngineState): boolean {
  return state.phase === 'finished' || state.phase === 'cancelled';
}

export function calculateNetWorthStandings(
  state: GameEngineState,
): PlayerNetWorth[] {
  const board = getGameBoard(state.boardKey);

  return getActivePlayers(state)
    .map((player) => calculatePlayerNetWorth(state, board, player))
    .sort((left, right) => {
      if (right.netWorth !== left.netWorth) {
        return right.netWorth - left.netWorth;
      }

      if (right.cash !== left.cash) {
        return right.cash - left.cash;
      }

      if (right.ownedPropertyCount !== left.ownedPropertyCount) {
        return right.ownedPropertyCount - left.ownedPropertyCount;
      }

      return left.seatNumber - right.seatNumber;
    });
}

export function getNetWorthWinner(
  standings: PlayerNetWorth[],
): PlayerNetWorth | null {
  return standings[0] ?? null;
}

export function getNetWorthWinners(
  standings: PlayerNetWorth[],
): PlayerNetWorth[] {
  const highestNetWorth = standings[0]?.netWorth;

  if (highestNetWorth === undefined) {
    return [];
  }

  return standings.filter((standing) => standing.netWorth === highestNetWorth);
}

export function calculatePlayerNetWorth(
  state: GameEngineState,
  board: GameBoard,
  player: GameEnginePlayer,
): PlayerNetWorth {
  const ownedProperties = getOwnedProperties(state, player.roomPlayerId);

  const assetValue = ownedProperties.reduce((total, property) => {
    const tile = getAssetTileByKey(board, property.tileKey);

    return total + calculateAssetNetWorth(tile, property);
  }, 0);

  return {
    roomPlayerId: player.roomPlayerId,
    seatNumber: player.seatNumber,
    cash: player.cash,
    ownedPropertyCount: ownedProperties.length,
    assetValue,
    netWorth: player.cash + assetValue,
  };
}

function calculateAssetNetWorth(
  tile: AssetTile,
  property: GameEngineProperty,
): number {
  const buildingValue =
    tile.kind === 'property'
      ? (property.houseCount + (property.hasHotel ? 5 : 0)) *
        (tile.houseCost / 2)
      : 0;

  const mortgagePenalty = property.mortgaged ? tile.mortgageValue : 0;

  return tile.price + buildingValue - mortgagePenalty;
}

function getAssetTileByKey(board: GameBoard, tileKey: string): AssetTile {
  const tile = board.tiles.find((candidate) => candidate.key === tileKey);

  if (!tile || !isAssetTile(tile)) {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile is not an asset');
  }

  return tile;
}

function isAssetTile(tile: GameTile): tile is AssetTile {
  return (
    tile.kind === 'property' ||
    tile.kind === 'airport' ||
    tile.kind === 'utility'
  );
}
