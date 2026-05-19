export type GameBoardKey = 'classic';

export type PropertySetKey =
  | 'brown'
  | 'light_blue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'dark_blue';

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

export type BaseGameTile = {
  index: number;
  key: string;
  name: string;
  kind: GameTileKind;
};

export type GoTile = BaseGameTile & {
  kind: 'go';
};

export type PropertyTile = BaseGameTile & {
  kind: 'property';
  setKey: PropertySetKey;
  price: number;
  baseRent: number;
  rentByHouseCount: readonly [number, number, number, number];
  hotelRent: number;
  houseCost: number;
  mortgageValue: number;
};

export type AirportTile = BaseGameTile & {
  kind: 'airport';
  price: number;
  rentByOwnedCount: readonly [number, number, number, number];
  mortgageValue: number;
};

export type UtilityTile = BaseGameTile & {
  kind: 'utility';
  price: number;
  rentMultiplierByOwnedCount: readonly [number, number];
  mortgageValue: number;
};

export type TaxTile = BaseGameTile & {
  kind: 'tax';
  amount: number;
};

export type ChanceTile = BaseGameTile & {
  kind: 'chance';
};

export type WorldFundTile = BaseGameTile & {
  kind: 'world_fund';
};

export type JailTile = BaseGameTile & {
  kind: 'jail';
};

export type FreeParkingTile = BaseGameTile & {
  kind: 'free_parking';
};

export type GoToJailTile = BaseGameTile & {
  kind: 'go_to_jail';
};

export type GameTile =
  | GoTile
  | PropertyTile
  | AirportTile
  | UtilityTile
  | TaxTile
  | ChanceTile
  | WorldFundTile
  | JailTile
  | FreeParkingTile
  | GoToJailTile;

export type GameBoard = {
  key: GameBoardKey;
  name: string;
  passGoCash: number;
  jailPosition: number;
  tiles: readonly GameTile[];
};
