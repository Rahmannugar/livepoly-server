import { CLASSIC_GAME_BOARD, getGameBoard, getTile } from '../game-board';
import type {
  AirportTile,
  PropertyTile,
  TaxTile,
  UtilityTile,
} from '../game-board.types';

describe('game-board', () => {
  it('defines the classic board with 40 ordered tiles', () => {
    expect(CLASSIC_GAME_BOARD.tiles).toHaveLength(40);

    CLASSIC_GAME_BOARD.tiles.forEach((tile, index) => {
      expect(tile.index).toBe(index);
      expect(tile.key).toBeTruthy();
      expect(tile.name).toBeTruthy();
      expect(tile.kind).toBeTruthy();
    });
  });

  it('returns the classic board by key', () => {
    expect(getGameBoard('classic')).toBe(CLASSIC_GAME_BOARD);
  });

  it('throws for an unknown board key', () => {
    expect(() => getGameBoard('unknown' as never)).toThrow(
      'Unknown game board: unknown',
    );
  });

  it('returns a tile by board position', () => {
    expect(getTile(CLASSIC_GAME_BOARD, 1)).toMatchObject({
      index: 1,
      key: 'nigeria',
      name: 'Nigeria',
      kind: 'property',
    });
  });

  it('throws for an unknown board position', () => {
    expect(() => getTile(CLASSIC_GAME_BOARD, 99)).toThrow(
      'Unknown board position: 99',
    );
  });

  it('defines economic fields for every property tile', () => {
    const properties = CLASSIC_GAME_BOARD.tiles.filter(
      (tile): tile is PropertyTile => tile.kind === 'property',
    );

    expect(properties.length).toBeGreaterThan(0);

    for (const tile of properties) {
      expect(tile.price).toBeGreaterThan(0);
      expect(tile.baseRent).toBeGreaterThan(0);
      expect(tile.rentByHouseCount).toHaveLength(4);
      expect(tile.hotelRent).toBeGreaterThan(tile.rentByHouseCount[3]);
      expect(tile.houseCost).toBeGreaterThan(0);
      expect(tile.mortgageValue).toBe(tile.price / 2);
    }
  });

  it('defines rent fields for every airport tile', () => {
    const airports = CLASSIC_GAME_BOARD.tiles.filter(
      (tile): tile is AirportTile => tile.kind === 'airport',
    );

    expect(airports).toHaveLength(4);

    for (const tile of airports) {
      expect(tile.price).toBe(200);
      expect(tile.rentByOwnedCount).toEqual([25, 50, 100, 200]);
      expect(tile.mortgageValue).toBe(100);
    }
  });

  it('defines multiplier fields for every utility tile', () => {
    const utilities = CLASSIC_GAME_BOARD.tiles.filter(
      (tile): tile is UtilityTile => tile.kind === 'utility',
    );

    expect(utilities).toHaveLength(2);

    for (const tile of utilities) {
      expect(tile.price).toBe(150);
      expect(tile.rentMultiplierByOwnedCount).toEqual([4, 10]);
      expect(tile.mortgageValue).toBe(75);
    }
  });

  it('defines amounts for every tax tile', () => {
    const taxes = CLASSIC_GAME_BOARD.tiles.filter(
      (tile): tile is TaxTile => tile.kind === 'tax',
    );

    expect(taxes).toHaveLength(2);

    for (const tile of taxes) {
      expect(tile.amount).toBeGreaterThan(0);
    }
  });
});
