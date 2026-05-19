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
import { cloneGameState } from './game-engine-cloner';
import { rollAndMove as movePlayer } from './game-engine-movement';
import { buyProperty as buyOwnableProperty } from './game-engine-properties';
import { endTurn as completeTurn } from './game-engine-turns';
import {
  type BuyPropertyInput,
  type DeclinePropertyInput,
  type EndTurnInput,
  type GameEngineResult,
  type GameEngineState,
  type PassAuctionBidInput,
  type PlaceAuctionBidInput,
  type RollAndMoveInput,
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

  endTurn(state: GameEngineState, input: EndTurnInput): GameEngineResult {
    assertCanEndTurn(state);
    assertCurrentTurn(state, input.roomPlayerId);

    return completeTurn(cloneGameState(state), input);
  }
}
