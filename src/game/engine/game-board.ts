import type { GameBoard, GameBoardKey } from './game-board.types';

export const CLASSIC_BOARD_KEY: GameBoardKey = 'classic';

export const CLASSIC_GAME_BOARD = {
  key: CLASSIC_BOARD_KEY,
  name: 'Classic World Board',
  passGoCash: 200,
  tiles: [
    { index: 0, key: 'go', name: 'Go', kind: 'go' },
    { index: 1, key: 'nigeria', name: 'Nigeria', kind: 'property' },
    { index: 2, key: 'world_fund_1', name: 'World Fund', kind: 'world_fund' },
    { index: 3, key: 'ghana', name: 'Ghana', kind: 'property' },
    { index: 4, key: 'income_tax', name: 'Income Tax', kind: 'tax' },
    { index: 5, key: 'lagos_airport', name: 'Lagos Airport', kind: 'airport' },
    { index: 6, key: 'south_africa', name: 'South Africa', kind: 'property' },
    { index: 7, key: 'chance_1', name: 'Chance', kind: 'chance' },
    { index: 8, key: 'egypt', name: 'Egypt', kind: 'property' },
    { index: 9, key: 'morocco', name: 'Morocco', kind: 'property' },
    { index: 10, key: 'jail', name: 'Jail', kind: 'jail' },
    { index: 11, key: 'brazil', name: 'Brazil', kind: 'property' },
    {
      index: 12,
      key: 'electric_company',
      name: 'Electric Company',
      kind: 'utility',
    },
    { index: 13, key: 'argentina', name: 'Argentina', kind: 'property' },
    { index: 14, key: 'mexico', name: 'Mexico', kind: 'property' },
    {
      index: 15,
      key: 'new_york_airport',
      name: 'New York Airport',
      kind: 'airport',
    },
    { index: 16, key: 'usa', name: 'USA', kind: 'property' },
    { index: 17, key: 'world_fund_2', name: 'World Fund', kind: 'world_fund' },
    { index: 18, key: 'canada', name: 'Canada', kind: 'property' },
    { index: 19, key: 'jamaica', name: 'Jamaica', kind: 'property' },
    {
      index: 20,
      key: 'free_parking',
      name: 'Free Parking',
      kind: 'free_parking',
    },
    { index: 21, key: 'uk', name: 'United Kingdom', kind: 'property' },
    { index: 22, key: 'chance_2', name: 'Chance', kind: 'chance' },
    { index: 23, key: 'france', name: 'France', kind: 'property' },
    { index: 24, key: 'spain', name: 'Spain', kind: 'property' },
    {
      index: 25,
      key: 'london_airport',
      name: 'London Airport',
      kind: 'airport',
    },
    { index: 26, key: 'germany', name: 'Germany', kind: 'property' },
    { index: 27, key: 'italy', name: 'Italy', kind: 'property' },
    { index: 28, key: 'water_works', name: 'Water Works', kind: 'utility' },
    { index: 29, key: 'netherlands', name: 'Netherlands', kind: 'property' },
    { index: 30, key: 'go_to_jail', name: 'Go To Jail', kind: 'go_to_jail' },
    { index: 31, key: 'india', name: 'India', kind: 'property' },
    { index: 32, key: 'china', name: 'China', kind: 'property' },
    { index: 33, key: 'world_fund_3', name: 'World Fund', kind: 'world_fund' },
    { index: 34, key: 'japan', name: 'Japan', kind: 'property' },
    { index: 35, key: 'tokyo_airport', name: 'Tokyo Airport', kind: 'airport' },
    { index: 36, key: 'chance_3', name: 'Chance', kind: 'chance' },
    { index: 37, key: 'south_korea', name: 'South Korea', kind: 'property' },
    { index: 38, key: 'luxury_tax', name: 'Luxury Tax', kind: 'tax' },
    { index: 39, key: 'australia', name: 'Australia', kind: 'property' },
  ],
} satisfies GameBoard;

export const GAME_BOARDS = {
  [CLASSIC_BOARD_KEY]: CLASSIC_GAME_BOARD,
} as const satisfies Record<GameBoardKey, GameBoard>;

export function getGameBoard(boardKey: GameBoardKey): GameBoard {
  return GAME_BOARDS[boardKey];
}
