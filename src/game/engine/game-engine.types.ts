import type { GameBoardKey } from './game-board.types';

export type GameMode = 'ranked' | 'casual';

export type GamePhase =
  | 'awaiting_first_turn'
  | 'awaiting_roll'
  | 'awaiting_property_decision'
  | 'awaiting_auction_bid'
  | 'awaiting_debt_resolution'
  | 'awaiting_turn_end'
  | 'finished'
  | 'cancelled';

export type PlayerType = 'human' | 'bot';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export type DiceRoll = readonly [number, number];

export type OwnableTileKind = 'property' | 'airport' | 'utility';

export type GameCardDeckKey = 'chance' | 'world_fund';

export type GameCardEffectType =
  | 'collect_money'
  | 'pay_money'
  | 'move_to_tile'
  | 'move_relative'
  | 'move_to_nearest'
  | 'go_to_jail'
  | 'get_out_of_jail_free'
  | 'collect_from_each_player'
  | 'pay_each_player'
  | 'property_repairs';

export type GameCardEffect =
  | {
      type: 'collect_money';
      amount: number;
    }
  | {
      type: 'pay_money';
      amount: number;
    }
  | {
      type: 'move_to_tile';
      tileKey: string;
      collectPassGo: boolean;
    }
  | {
      type: 'move_relative';
      spaces: number;
    }
  | {
      type: 'move_to_nearest';
      tileKind: OwnableTileKind;
      collectPassGo: boolean;
    }
  | {
      type: 'go_to_jail';
    }
  | {
      type: 'get_out_of_jail_free';
    }
  | {
      type: 'collect_from_each_player';
      amount: number;
    }
  | {
      type: 'pay_each_player';
      amount: number;
    }
  | {
      type: 'property_repairs';
      houseAmount: number;
      hotelAmount: number;
    };

export type GameEngineCard = {
  key: string;
  title: string;
  effect: GameCardEffect;
};

export type GameEngineDeckState = {
  drawPile: string[];
  discardPile: string[];
};

export type GameEngineDecks = {
  chance: GameEngineDeckState;
  worldFund: GameEngineDeckState;
};

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
  jailTurnCount: number;
  getOutOfJailFreeCards: number;
  consecutiveMissedTurns?: number;
  lastMissedTurnNumber?: number | null;
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
  currentBidderRoomPlayerId: string | null;
  activeRoomPlayerIds: string[];
  passedRoomPlayerIds: string[];
};

export type GameEngineDebtReason = 'rent' | 'tax' | 'card' | 'jail_fine';

export type GameEngineDebt = {
  roomPlayerId: string;
  creditorRoomPlayerId: string | null;
  amount: number;
  reason: GameEngineDebtReason;
};

export type GameEngineState = {
  version: 1;
  roomId: string;
  roomCode: string;
  boardKey: GameBoardKey;
  mode: GameMode;
  startedAt?: number | null;
  durationMinutes?: number | null;
  expiresAt?: number | null;
  turnExpiresAt?: number | null;
  phase: GamePhase;
  turnNumber: number;
  currentTurnRoomPlayerId: string;
  consecutiveDoublesCount: number;
  shouldCurrentPlayerPlayAgain: boolean;
  lastDiceRoll?: DiceRoll | null;
  pendingTileKey?: string | null;
  auction?: GameEngineAuction | null;
  debt?: GameEngineDebt | null;
  decks: GameEngineDecks;
  players: GameEnginePlayer[];
  properties: GameEngineProperty[];
};

export type PlayerNetWorth = {
  roomPlayerId: string;
  seatNumber: number;
  cash: number;
  ownedPropertyCount: number;
  assetValue: number;
  netWorth: number;
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

export type BuildPropertyInput = {
  roomPlayerId: string;
  tileKey: string;
};

export type SellBuildingInput = {
  roomPlayerId: string;
  tileKey: string;
};

export type MortgagePropertyInput = {
  roomPlayerId: string;
  tileKey: string;
};

export type UnmortgagePropertyInput = {
  roomPlayerId: string;
  tileKey: string;
};

export type DeclareBankruptcyInput = {
  roomPlayerId: string;
  creditorRoomPlayerId?: string | null;
};

export type PayDebtInput = {
  roomPlayerId: string;
};

export type FinishGameByTimeInput = {
  finishedAt: number;
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

export type PayJailFineInput = {
  roomPlayerId: string;
};

export type DrawCardInput = {
  roomPlayerId: string;
  deckKey: GameCardDeckKey;
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
      type: 'player_rolled_doubles';
      roomPlayerId: string;
      consecutiveDoublesCount: number;
    }
  | {
      type: 'player_rolled_third_doubles';
      roomPlayerId: string;
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
      type: 'card_drawn';
      roomPlayerId: string;
      deckKey: GameCardDeckKey;
      cardKey: string;
    }
  | {
      type: 'card_applied';
      roomPlayerId: string;
      deckKey: GameCardDeckKey;
      cardKey: string;
      effectType: GameCardEffectType;
    }
  | {
      type: 'player_sent_to_jail';
      roomPlayerId: string;
      jailPosition: number;
    }
  | {
      type: 'jail_escape_roll_succeeded';
      roomPlayerId: string;
      dice: DiceRoll;
    }
  | {
      type: 'jail_escape_roll_failed';
      roomPlayerId: string;
      dice: DiceRoll;
      jailTurnCount: number;
    }
  | {
      type: 'jail_forced_fine_paid';
      roomPlayerId: string;
      amount: number;
    }
  | {
      type: 'jail_fine_paid';
      roomPlayerId: string;
      amount: number;
    }
  | {
      type: 'player_released_from_jail';
      roomPlayerId: string;
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
      type: 'tax_paid';
      roomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'payment_required';
      roomPlayerId: string;
      creditorRoomPlayerId: string | null;
      amount: number;
      reason: GameEngineDebtReason;
    }
  | {
      type: 'debt_paid';
      roomPlayerId: string;
      creditorRoomPlayerId: string | null;
      amount: number;
      reason: GameEngineDebtReason;
    }
  | {
      type: 'property_house_built';
      roomPlayerId: string;
      tileKey: string;
      houseCount: number;
      amount: number;
    }
  | {
      type: 'property_hotel_built';
      roomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'property_house_sold';
      roomPlayerId: string;
      tileKey: string;
      houseCount: number;
      amount: number;
    }
  | {
      type: 'property_hotel_sold';
      roomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'property_mortgaged';
      roomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'property_unmortgaged';
      roomPlayerId: string;
      tileKey: string;
      amount: number;
    }
  | {
      type: 'player_bankrupt';
      roomPlayerId: string;
      creditorRoomPlayerId: string | null;
    }
  | {
      type: 'game_finished_by_bankruptcy';
      winnerRoomPlayerId: string | null;
      tiedRoomPlayerIds: string[];
      standings: PlayerNetWorth[];
    }
  | {
      type: 'game_finished_by_time';
      finishedAt: number;
      winnerRoomPlayerId: string | null;
      tiedRoomPlayerIds: string[];
      standings: PlayerNetWorth[];
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
  | 'DEBT_RESOLUTION_REQUIRED'
  | 'NO_ACTIVE_DEBT'
  | 'JAIL_FINE_NOT_ALLOWED'
  | 'TURN_END_NOT_ALLOWED'
  | 'NO_ACTIVE_PLAYERS'
  | 'NO_PROPERTY_DECISION'
  | 'NO_ACTIVE_AUCTION'
  | 'TILE_NOT_OWNABLE'
  | 'PROPERTY_ALREADY_OWNED'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_AUCTION_BID'
  | 'AUCTION_PLAYER_NOT_ACTIVE'
  | 'AUCTION_PLAYER_NOT_CURRENT'
  | 'PLAYER_NOT_IN_JAIL'
  | 'CARD_NOT_FOUND'
  | 'CARD_DECK_EMPTY'
  | 'BUILDING_NOT_ALLOWED'
  | 'PROPERTY_SET_NOT_OWNED'
  | 'PROPERTY_MORTGAGED'
  | 'BUILDING_LIMIT_REACHED'
  | 'UNEVEN_BUILDING'
  | 'NO_BUILDING_TO_SELL'
  | 'MORTGAGE_NOT_ALLOWED'
  | 'PROPERTY_NOT_OWNED'
  | 'PROPERTY_HAS_BUILDINGS'
  | 'PROPERTY_ALREADY_MORTGAGED'
  | 'PROPERTY_NOT_MORTGAGED'
  | 'PLAYER_ALREADY_BANKRUPT'
  | 'INVALID_BANKRUPTCY_CREDITOR'
  | 'INVALID_FINISH_TIME'
  | 'GAME_TIME_NOT_EXPIRED';

export class GameEngineError extends Error {
  constructor(
    public readonly code: GameEngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameEngineError';
  }
}
