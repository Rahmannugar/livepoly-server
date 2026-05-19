import { Injectable } from '@nestjs/common';
import type { GameEngineIntent } from '../engine/game-engine-intents';
import type {
  DiceRoll,
  GameEnginePlayer,
  GameEngineState,
} from '../engine/game-engine.types';

@Injectable()
export class GameTurnTimerPolicyService {
  chooseTimeoutIntent(state: GameEngineState): GameEngineIntent | null {
    if (state.phase === 'finished' || state.phase === 'cancelled') {
      return null;
    }

    const currentPlayer = this.findPlayer(state, state.currentTurnRoomPlayerId);

    if (!currentPlayer || currentPlayer.bankrupt) {
      return null;
    }

    if (
      state.phase === 'awaiting_first_turn' ||
      state.phase === 'awaiting_roll'
    ) {
      return {
        type: 'roll_and_move',
        payload: {
          roomPlayerId: currentPlayer.roomPlayerId,
          dice: this.rollDice(),
        },
      };
    }

    if (state.phase === 'awaiting_property_decision') {
      return {
        type: 'decline_property_purchase',
        payload: {
          roomPlayerId: currentPlayer.roomPlayerId,
        },
      };
    }

    if (state.phase === 'awaiting_auction_bid') {
      const auctionRoomPlayerId = this.findAuctionTimeoutPlayer(state);

      if (!auctionRoomPlayerId) {
        return null;
      }

      return {
        type: 'pass_auction_bid',
        payload: {
          roomPlayerId: auctionRoomPlayerId,
        },
      };
    }

    if (state.phase === 'awaiting_debt_resolution') {
      if (!state.debt) {
        return null;
      }

      return {
        type: 'declare_bankruptcy',
        payload: {
          roomPlayerId: state.debt.roomPlayerId,
          creditorRoomPlayerId: state.debt.creditorRoomPlayerId,
        },
      };
    }

    if (state.phase === 'awaiting_turn_end') {
      return {
        type: 'end_turn',
        payload: {
          roomPlayerId: currentPlayer.roomPlayerId,
        },
      };
    }

    return null;
  }

  private findAuctionTimeoutPlayer(state: GameEngineState): string | null {
    if (!state.auction) {
      return null;
    }

    return (
      state.auction.activeRoomPlayerIds.find(
        (roomPlayerId) =>
          !state.auction?.passedRoomPlayerIds.includes(roomPlayerId),
      ) ?? null
    );
  }

  private findPlayer(
    state: GameEngineState,
    roomPlayerId: string,
  ): GameEnginePlayer | null {
    return (
      state.players.find((player) => player.roomPlayerId === roomPlayerId) ??
      null
    );
  }

  private rollDice(): DiceRoll {
    return [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ];
  }
}
