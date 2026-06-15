import { GameEngineService } from './game-engine.service';
import type {
  AcceptTradeInput,
  BuildPropertyInput,
  BuyPropertyInput,
  CancelTradeInput,
  DeclareBankruptcyInput,
  DeclinePropertyInput,
  EndTurnInput,
  FinishGameAfterLastHumanLeftInput,
  FinishGameByTimeInput,
  GameEngineResult,
  GameEngineState,
  MortgagePropertyInput,
  PassAuctionBidInput,
  PayDebtInput,
  PayJailFineInput,
  PlaceAuctionBidInput,
  ProposeTradeInput,
  RejectTradeInput,
  RollAndMoveInput,
  SellBuildingInput,
  UnmortgagePropertyInput,
  UseGetOutOfJailCardInput,
} from './game-engine.types';

export type GameEngineIntent =
  | {
      type: 'roll_and_move';
      payload: RollAndMoveInput;
    }
  | {
      type: 'buy_property';
      payload: BuyPropertyInput;
    }
  | {
      type: 'decline_property_purchase';
      payload: DeclinePropertyInput;
    }
  | {
      type: 'place_auction_bid';
      payload: PlaceAuctionBidInput;
    }
  | {
      type: 'pass_auction_bid';
      payload: PassAuctionBidInput;
    }
  | {
      type: 'build_property';
      payload: BuildPropertyInput;
    }
  | {
      type: 'sell_building';
      payload: SellBuildingInput;
    }
  | {
      type: 'mortgage_property';
      payload: MortgagePropertyInput;
    }
  | {
      type: 'unmortgage_property';
      payload: UnmortgagePropertyInput;
    }
  | {
      type: 'propose_trade';
      payload: ProposeTradeInput;
    }
  | {
      type: 'accept_trade';
      payload: AcceptTradeInput;
    }
  | {
      type: 'reject_trade';
      payload: RejectTradeInput;
    }
  | {
      type: 'cancel_trade';
      payload: CancelTradeInput;
    }
  | {
      type: 'declare_bankruptcy';
      payload: DeclareBankruptcyInput;
    }
  | {
      type: 'pay_debt';
      payload: PayDebtInput;
    }
  | {
      type: 'pay_jail_fine';
      payload: PayJailFineInput;
    }
  | {
      type: 'use_get_out_of_jail_card';
      payload: UseGetOutOfJailCardInput;
    }
  | {
      type: 'end_turn';
      payload: EndTurnInput;
    }
  | {
      type: 'finish_game_by_time';
      payload: FinishGameByTimeInput;
    }
  | {
      type: 'finish_game_after_last_human_left';
      payload: FinishGameAfterLastHumanLeftInput;
    };

const engine = new GameEngineService();

export function reduceGameEngineIntent(
  state: GameEngineState,
  intent: GameEngineIntent,
): GameEngineResult {
  switch (intent.type) {
    case 'roll_and_move':
      return engine.rollAndMove(state, intent.payload);

    case 'buy_property':
      return engine.buyProperty(state, intent.payload);

    case 'decline_property_purchase':
      return engine.declinePropertyPurchase(state, intent.payload);

    case 'place_auction_bid':
      return engine.placeAuctionBid(state, intent.payload);

    case 'pass_auction_bid':
      return engine.passAuctionBid(state, intent.payload);

    case 'build_property':
      return engine.buildProperty(state, intent.payload);

    case 'sell_building':
      return engine.sellBuilding(state, intent.payload);

    case 'mortgage_property':
      return engine.mortgageProperty(state, intent.payload);

    case 'unmortgage_property':
      return engine.unmortgageProperty(state, intent.payload);

    case 'propose_trade':
      return engine.proposeTrade(state, intent.payload);

    case 'accept_trade':
      return engine.acceptTrade(state, intent.payload);

    case 'reject_trade':
      return engine.rejectTrade(state, intent.payload);

    case 'cancel_trade':
      return engine.cancelTrade(state, intent.payload);

    case 'declare_bankruptcy':
      return engine.declareBankruptcy(state, intent.payload);

    case 'pay_debt':
      return engine.payDebt(state, intent.payload);

    case 'pay_jail_fine':
      return engine.payJailFine(state, intent.payload);

    case 'use_get_out_of_jail_card':
      return engine.useGetOutOfJailCard(state, intent.payload);

    case 'end_turn':
      return engine.endTurn(state, intent.payload);

    case 'finish_game_by_time':
      return engine.finishGameByTime(state, intent.payload);

    case 'finish_game_after_last_human_left':
      return engine.finishGameAfterLastHumanLeft(state, intent.payload);
  }
}
