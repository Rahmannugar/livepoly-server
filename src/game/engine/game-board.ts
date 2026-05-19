import type {
  AirportTile,
  GameBoard,
  GameBoardKey,
  GameTile,
  PropertySetKey,
  PropertyTile,
  TaxTile,
  UtilityTile,
} from './game-board.types';

export const CLASSIC_BOARD_KEY: GameBoardKey = 'classic';

function property(
  index: number,
  key: string,
  name: string,
  setKey: PropertySetKey,
  price: number,
  baseRent: number,
  rentByHouseCount: readonly [number, number, number, number],
  hotelRent: number,
  houseCost: number,
): PropertyTile {
  return {
    index,
    key,
    name,
    kind: 'property',
    setKey,
    price,
    baseRent,
    rentByHouseCount,
    hotelRent,
    houseCost,
    mortgageValue: price / 2,
  };
}

function airport(index: number, key: string, name: string): AirportTile {
  return {
    index,
    key,
    name,
    kind: 'airport',
    price: 200,
    rentByOwnedCount: [25, 50, 100, 200],
    mortgageValue: 100,
  };
}

function utility(index: number, key: string, name: string): UtilityTile {
  return {
    index,
    key,
    name,
    kind: 'utility',
    price: 150,
    rentMultiplierByOwnedCount: [4, 10],
    mortgageValue: 75,
  };
}

function tax(
  index: number,
  key: string,
  name: string,
  amount: number,
): TaxTile {
  return {
    index,
    key,
    name,
    kind: 'tax',
    amount,
  };
}

export const CLASSIC_GAME_BOARD = {
  key: CLASSIC_BOARD_KEY,
  name: 'Classic World Board',
  passGoCash: 200,
  jailPosition: 10,
  tiles: [
    { index: 0, key: 'go', name: 'Go', kind: 'go' },

    property(
      1,
      'nigeria',
      'Nigeria',
      'brown',
      60,
      2,
      [10, 30, 90, 160],
      250,
      50,
    ),
    { index: 2, key: 'world_fund_1', name: 'World Fund', kind: 'world_fund' },
    property(3, 'ghana', 'Ghana', 'brown', 60, 4, [20, 60, 180, 320], 450, 50),
    tax(4, 'income_tax', 'Income Tax', 200),
    airport(5, 'lagos_airport', 'Lagos Airport'),

    property(
      6,
      'south_africa',
      'South Africa',
      'light_blue',
      100,
      6,
      [30, 90, 270, 400],
      550,
      50,
    ),
    { index: 7, key: 'chance_1', name: 'Chance', kind: 'chance' },
    property(
      8,
      'egypt',
      'Egypt',
      'light_blue',
      100,
      6,
      [30, 90, 270, 400],
      550,
      50,
    ),
    property(
      9,
      'morocco',
      'Morocco',
      'light_blue',
      120,
      8,
      [40, 100, 300, 450],
      600,
      50,
    ),

    { index: 10, key: 'jail', name: 'Jail', kind: 'jail' },

    property(
      11,
      'brazil',
      'Brazil',
      'pink',
      140,
      10,
      [50, 150, 450, 625],
      750,
      100,
    ),
    utility(12, 'electric_company', 'Electric Company'),
    property(
      13,
      'argentina',
      'Argentina',
      'pink',
      140,
      10,
      [50, 150, 450, 625],
      750,
      100,
    ),
    property(
      14,
      'mexico',
      'Mexico',
      'pink',
      160,
      12,
      [60, 180, 500, 700],
      900,
      100,
    ),
    airport(15, 'new_york_airport', 'New York Airport'),

    property(
      16,
      'usa',
      'USA',
      'orange',
      180,
      14,
      [70, 200, 550, 750],
      950,
      100,
    ),
    { index: 17, key: 'world_fund_2', name: 'World Fund', kind: 'world_fund' },
    property(
      18,
      'canada',
      'Canada',
      'orange',
      180,
      14,
      [70, 200, 550, 750],
      950,
      100,
    ),
    property(
      19,
      'jamaica',
      'Jamaica',
      'orange',
      200,
      16,
      [80, 220, 600, 800],
      1000,
      100,
    ),

    {
      index: 20,
      key: 'free_parking',
      name: 'Free Parking',
      kind: 'free_parking',
    },

    property(
      21,
      'uk',
      'United Kingdom',
      'red',
      220,
      18,
      [90, 250, 700, 875],
      1050,
      150,
    ),
    { index: 22, key: 'chance_2', name: 'Chance', kind: 'chance' },
    property(
      23,
      'france',
      'France',
      'red',
      220,
      18,
      [90, 250, 700, 875],
      1050,
      150,
    ),
    property(
      24,
      'spain',
      'Spain',
      'red',
      240,
      20,
      [100, 300, 750, 925],
      1100,
      150,
    ),
    airport(25, 'london_airport', 'London Airport'),

    property(
      26,
      'germany',
      'Germany',
      'yellow',
      260,
      22,
      [110, 330, 800, 975],
      1150,
      150,
    ),
    property(
      27,
      'italy',
      'Italy',
      'yellow',
      260,
      22,
      [110, 330, 800, 975],
      1150,
      150,
    ),
    utility(28, 'water_works', 'Water Works'),
    property(
      29,
      'netherlands',
      'Netherlands',
      'yellow',
      280,
      24,
      [120, 360, 850, 1025],
      1200,
      150,
    ),

    { index: 30, key: 'go_to_jail', name: 'Go To Jail', kind: 'go_to_jail' },

    property(
      31,
      'india',
      'India',
      'green',
      300,
      26,
      [130, 390, 900, 1100],
      1275,
      200,
    ),
    property(
      32,
      'china',
      'China',
      'green',
      300,
      26,
      [130, 390, 900, 1100],
      1275,
      200,
    ),
    { index: 33, key: 'world_fund_3', name: 'World Fund', kind: 'world_fund' },
    property(
      34,
      'japan',
      'Japan',
      'green',
      320,
      28,
      [150, 450, 1000, 1200],
      1400,
      200,
    ),
    airport(35, 'tokyo_airport', 'Tokyo Airport'),

    { index: 36, key: 'chance_3', name: 'Chance', kind: 'chance' },
    property(
      37,
      'south_korea',
      'South Korea',
      'dark_blue',
      350,
      35,
      [175, 500, 1100, 1300],
      1500,
      200,
    ),
    tax(38, 'luxury_tax', 'Luxury Tax', 100),
    property(
      39,
      'australia',
      'Australia',
      'dark_blue',
      400,
      50,
      [200, 600, 1400, 1700],
      2000,
      200,
    ),
  ],
} satisfies GameBoard;

export const GAME_BOARDS = {
  [CLASSIC_BOARD_KEY]: CLASSIC_GAME_BOARD,
} as const satisfies Record<GameBoardKey, GameBoard>;

export function getGameBoard(boardKey: GameBoardKey): GameBoard {
  const board = GAME_BOARDS[boardKey];

  if (!board) {
    throw new Error(`Unknown game board: ${boardKey}`);
  }

  return board;
}

export function getTile(board: GameBoard, position: number): GameTile {
  const tile = board.tiles[position];

  if (!tile) {
    throw new Error(`Unknown board position: ${position}`);
  }

  return tile;
}
