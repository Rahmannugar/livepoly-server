import {
  declinePropertyPurchase as declineOwnableProperty,
  passAuctionBid as passOwnableAuctionBid,
  placeAuctionBid as placeOwnableAuctionBid,
} from './game-engine-auctions';
import {
  assertCanBuyProperty,
  assertCanEndTurn,
  assertCanRoll,
  assertCurrentTurn,
  assertValidDice,
} from './game-engine-assertions';
import { declareBankruptcy as declarePlayerBankruptcy } from './game-engine-bankruptcy';
import {
  buildProperty as buildPropertyBuilding,
  sellBuilding as sellPropertyBuilding,
} from './game-engine-buildings';
import { cloneGameState } from './game-engine-cloner';
import { payDebt as payPlayerDebt } from './game-engine-debt';
import { finishGameByTime as finishGameByExpiredTime } from './game-engine-finish';
import { payJailFine as payPlayerJailFine } from './game-engine-jail';
import {
  mortgageProperty as mortgageOwnableProperty,
  unmortgageProperty as unmortgageOwnableProperty,
} from './game-engine-mortgage';
import { rollAndMove as movePlayer } from './game-engine-movement';
import { buyProperty as buyOwnableProperty } from './game-engine-properties';
import { endTurn as completeTurn } from './game-engine-turns';
import {
  type BuildPropertyInput,
  type BuyPropertyInput,
  type DeclareBankruptcyInput,
  type DeclinePropertyInput,
  type EndTurnInput,
  type FinishGameByTimeInput,
  type GameEngineResult,
  type GameEngineState,
  type MortgagePropertyInput,
  type PassAuctionBidInput,
  type PayDebtInput,
  type PayJailFineInput,
  type PlaceAuctionBidInput,
  type RollAndMoveInput,
  type SellBuildingInput,
  type UnmortgagePropertyInput,
} from './game-engine.types';

export class GameEngineService {
  rollAndMove(
    state: GameEngineState,
    input: RollAndMoveInput,
  ): GameEngineResult {
    assertCanRoll(state);
    assertCurrentTurn(state, input.roomPlayerId);
    assertValidDice(input.dice);

    return movePlayer(cloneGameState(state), input);
  }

  buyProperty(
    state: GameEngineState,
    input: BuyPropertyInput,
  ): GameEngineResult {
    assertCanBuyProperty(state);
    assertCurrentTurn(state, input.roomPlayerId);

    return buyOwnableProperty(cloneGameState(state), input);
  }

  declinePropertyPurchase(
    state: GameEngineState,
    input: DeclinePropertyInput,
  ): GameEngineResult {
    assertCanBuyProperty(state);
    assertCurrentTurn(state, input.roomPlayerId);

    return declineOwnableProperty(cloneGameState(state), input);
  }

  placeAuctionBid(
    state: GameEngineState,
    input: PlaceAuctionBidInput,
  ): GameEngineResult {
    return placeOwnableAuctionBid(cloneGameState(state), input);
  }

  passAuctionBid(
    state: GameEngineState,
    input: PassAuctionBidInput,
  ): GameEngineResult {
    return passOwnableAuctionBid(cloneGameState(state), input);
  }

  buildProperty(
    state: GameEngineState,
    input: BuildPropertyInput,
  ): GameEngineResult {
    assertCurrentTurn(state, input.roomPlayerId);

    return buildPropertyBuilding(cloneGameState(state), input);
  }

  sellBuilding(
    state: GameEngineState,
    input: SellBuildingInput,
  ): GameEngineResult {
    assertCurrentTurn(state, input.roomPlayerId);

    return sellPropertyBuilding(cloneGameState(state), input);
  }

  mortgageProperty(
    state: GameEngineState,
    input: MortgagePropertyInput,
  ): GameEngineResult {
    assertCurrentTurn(state, input.roomPlayerId);

    return mortgageOwnableProperty(cloneGameState(state), input);
  }

  unmortgageProperty(
    state: GameEngineState,
    input: UnmortgagePropertyInput,
  ): GameEngineResult {
    assertCurrentTurn(state, input.roomPlayerId);

    return unmortgageOwnableProperty(cloneGameState(state), input);
  }

  declareBankruptcy(
    state: GameEngineState,
    input: DeclareBankruptcyInput,
  ): GameEngineResult {
    return declarePlayerBankruptcy(cloneGameState(state), input);
  }

  payDebt(state: GameEngineState, input: PayDebtInput): GameEngineResult {
    return payPlayerDebt(cloneGameState(state), input);
  }

  finishGameByTime(
    state: GameEngineState,
    input: FinishGameByTimeInput,
  ): GameEngineResult {
    return finishGameByExpiredTime(cloneGameState(state), input);
  }

  payJailFine(
    state: GameEngineState,
    input: PayJailFineInput,
  ): GameEngineResult {
    assertCurrentTurn(state, input.roomPlayerId);

    return payPlayerJailFine(cloneGameState(state), input);
  }

  endTurn(state: GameEngineState, input: EndTurnInput): GameEngineResult {
    assertCanEndTurn(state);
    assertCurrentTurn(state, input.roomPlayerId);

    return completeTurn(cloneGameState(state), input);
  }
}
