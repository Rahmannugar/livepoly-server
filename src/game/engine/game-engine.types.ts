import type { GameBoardKey } from './game-board.types';

export type GameMode = 'ranked' | 'casual';

export type GamePhase =
  | 'awaiting_first_turn'
  | 'awaiting_roll'
  | 'awaiting_property_decision'
  | 'awaiting_auction_bid'
  | 'awaiting_turn_end'
  | 'finished'
  | 'cancelled';

export type PlayerType = 'human' | 'bot';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export type DiceRoll = readonly [number, number];

export type OwnableTileKind = 'property' | 'airport' | 'utility';

export type GameEnginePlayer = {
  roomPlayerId: string;
  userId: string | null;
  username: string | null;
  playerType: PlayerType;
  botDifficulty: BotDifficulty | null;
  botName: string | null;
  seatNumber: number;
  cash: number;
  position: number;
  inJail: boolean;
  bankrupt: boolean;
};

export type GameEngineProperty = {
  tileKey: string;
  ownerRoomPlayerId: string | null;
  houseCount: number;
  hasHotel: boolean;
  mortgaged: boolean;
};

export type GameEngineAuction = {
  tileKey: string;
  currentBid: number;
  highestBidderRoomPlayerId: string | null;
  activeRoomPlayerIds: string[];
  passedRoomPlayerIds: string[];
};

export type GameEngineState = {
  version: 1;
  roomId: string;
  roomCode: string;
  boardKey: GameBoardKey;
  mode: GameMode;
  phase: GamePhase;
  turnNumber: number;
  currentTurnRoomPlayerId: string;
  lastDiceRoll?: DiceRoll | null;
  pendingTileKey?: string | null;
  auction?: GameEngineAuction | null;
  players: GameEnginePlayer[];
  properties: GameEngineProperty[];
};

export type RollAndMoveInput = {
  roomPlayerId: string;
  dice: DiceRoll;
};

export type EndTurnInput = {
  roomPlayerId: string;
};

export type BuyPropertyInput = {
  roomPlayerId: string;
};

export type DeclinePropertyInput = {
  roomPlayerId: string;
};

export type PlaceAuctionBidInput = {
  roomPlayerId: string;
  amount: number;
};

export type PassAuctionBidInput = {
  roomPlayerId: string;
};

export type PayRentInput = {
  payerRoomPlayerId: string;
  tileKey: string;
  dice: DiceRoll;
};

export type GameEngineEvent =
  | {
      type: 'player_moved';
      roomPlayerId: string;
      fromPosition: number;
      toPosition: number;
      dice: DiceRoll;
    }
  | {
      type: 'player_passed_go';
      roomPlayerId: string;
      amount: number;
    }
  | {
      type: 'player_landed_on_tile';
      roomPlayerId: string;
      tileKey: string;
      tileKind: string;
    }
  | {
      type: 'property_bought';
      roomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'property_purchase_declined';
      roomPlayerId: string;
      tileKey: string;
    }
  | {
      type: 'auction_started';
      tileKey: string;
      activeRoomPlayerIds: string[];
    }
  | {
      type: 'auction_bid_placed';
      roomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'auction_bid_passed';
      roomPlayerId: string;
      tileKey: string;
    }
  | {
      type: 'auction_won';
      roomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'rent_paid';
      payerRoomPlayerId: string;
      ownerRoomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'turn_ended';
      roomPlayerId: string;
      nextRoomPlayerId: string;
      turnNumber: number;
    };

export type GameEngineResult = {
  state: GameEngineState;
  events: GameEngineEvent[];
};

export type GameEngineErrorCode =
  | 'GAME_NOT_ACTIVE'
  | 'PLAYER_NOT_FOUND'
  | 'NOT_CURRENT_TURN'
  | 'INVALID_DICE'
  | 'ROLL_NOT_ALLOWED'
  | 'BUY_NOT_ALLOWED'
  | 'AUCTION_NOT_ALLOWED'
  | 'TURN_END_NOT_ALLOWED'
  | 'NO_ACTIVE_PLAYERS'
  | 'NO_PROPERTY_DECISION'
  | 'NO_ACTIVE_AUCTION'
  | 'TILE_NOT_OWNABLE'
  | 'PROPERTY_ALREADY_OWNED'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_AUCTION_BID'
  | 'AUCTION_PLAYER_NOT_ACTIVE';

export class GameEngineError extends Error {
  constructor(
    public readonly code: GameEngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameEngineError';
  }
}
