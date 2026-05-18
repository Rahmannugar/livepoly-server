export type GameBoardKey = 'classic';

export type GameTileKind =
  | 'go'
  | 'property'
  | 'airport'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'world_fund'
  | 'jail'
  | 'free_parking'
  | 'go_to_jail';

export type GameTile = {
  index: number;
  key: string;
  name: string;
  kind: GameTileKind;
};

export type GameBoard = {
  key: GameBoardKey;
  name: string;
  passGoCash: number;
  tiles: readonly GameTile[];
};
