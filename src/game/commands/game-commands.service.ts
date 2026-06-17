import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ObservabilityService } from '../../infra/observability/observability.service';
import {
  incrementMissedTurn,
  resetMissedTurn,
} from '../engine/game-engine-missed-turns';
import { GAME_EVENTS, GAME_METRICS, GAME_TURN_TIMER } from '../game.constants';
import {
  reduceGameEngineIntent,
  type GameEngineIntent,
} from '../engine/game-engine-intents';
import {
  GameEngineError,
  type GameEngineState,
} from '../engine/game-engine.types';
import { GameRecoveryService } from '../recovery/game-recovery.service';
import { GameResultsService } from '../results/game-results.service';
import { GameSnapshotService } from '../snapshots/game-snapshots.service';
import { GameStateService } from '../state/game-state.service';
import { GameEventsService } from '../events/game-events.service';
import type {
  EndTurnCommand,
  ExecuteGameIntentCommand,
  GameCommandResult,
  GameCommandSource,
  PlaceAuctionBidCommand,
  ProposeTradeCommand,
  PropertyCommand,
  RoomPlayerCommand,
  RollAndMoveCommand,
  TradeDecisionCommand,
} from './game-commands.types';

@Injectable()
export class GameCommandsService {
  constructor(
    private readonly gameStateService: GameStateService,
    private readonly observabilityService: ObservabilityService,
    private readonly gameSnapshotService: GameSnapshotService,
    private readonly gameRecoveryService: GameRecoveryService,
    private readonly gameResultsService: GameResultsService,
    private readonly gameEventsService: GameEventsService,
  ) {}

  async executeIntent(
    input: ExecuteGameIntentCommand,
  ): Promise<GameCommandResult> {
    this.assertIntentActorMatchesCommand(input);

    return this.executeIntentWithRecovery(input, false);
  }

  async rollAndMove(input: RollAndMoveCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'roll_and_move',
        payload: {
          roomPlayerId: input.roomPlayerId,
          dice: input.dice,
        },
      },
    });
  }

  async endTurn(input: EndTurnCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'end_turn',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
    });
  }

  async buyProperty(input: RoomPlayerCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'buy_property',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
    });
  }

  async declinePropertyPurchase(
    input: RoomPlayerCommand,
  ): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'decline_property_purchase',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
    });
  }

  async placeAuctionBid(
    input: PlaceAuctionBidCommand,
  ): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'place_auction_bid',
        payload: {
          roomPlayerId: input.roomPlayerId,
          amount: input.amount,
        },
      },
    });
  }

  async passAuctionBid(input: RoomPlayerCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'pass_auction_bid',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
    });
  }

  async payDebt(input: RoomPlayerCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'pay_debt',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
    });
  }

  async payJailFine(input: RoomPlayerCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'pay_jail_fine',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
    });
  }

  async useGetOutOfJailCard(
    input: RoomPlayerCommand,
  ): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'use_get_out_of_jail_card',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
    });
  }

  async declareBankruptcy(
    input: RoomPlayerCommand,
  ): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'declare_bankruptcy',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
    });
  }

  async buildProperty(input: PropertyCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'build_property',
        payload: {
          roomPlayerId: input.roomPlayerId,
          tileKey: input.tileKey,
        },
      },
    });
  }

  async sellBuilding(input: PropertyCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'sell_building',
        payload: {
          roomPlayerId: input.roomPlayerId,
          tileKey: input.tileKey,
        },
      },
    });
  }

  async mortgageProperty(input: PropertyCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'mortgage_property',
        payload: {
          roomPlayerId: input.roomPlayerId,
          tileKey: input.tileKey,
        },
      },
    });
  }

  async unmortgageProperty(input: PropertyCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'unmortgage_property',
        payload: {
          roomPlayerId: input.roomPlayerId,
          tileKey: input.tileKey,
        },
      },
    });
  }

  async proposeTrade(input: ProposeTradeCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'propose_trade',
        payload: {
          roomPlayerId: input.roomPlayerId,
          toRoomPlayerId: input.toRoomPlayerId,
          offeredCash: input.offeredCash,
          requestedCash: input.requestedCash,
          offeredPropertyKeys: input.offeredPropertyKeys,
          requestedPropertyKeys: input.requestedPropertyKeys,
        },
      },
    });
  }

  async acceptTrade(input: TradeDecisionCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'accept_trade',
        payload: {
          roomPlayerId: input.roomPlayerId,
          tradeId: input.tradeId,
        },
      },
    });
  }

  async rejectTrade(input: TradeDecisionCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'reject_trade',
        payload: {
          roomPlayerId: input.roomPlayerId,
          tradeId: input.tradeId,
        },
      },
    });
  }

  async cancelTrade(input: TradeDecisionCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
      source: 'player',
      intent: {
        type: 'cancel_trade',
        payload: {
          roomPlayerId: input.roomPlayerId,
          tradeId: input.tradeId,
        },
      },
    });
  }

  private async executeIntentWithRecovery(
    input: ExecuteGameIntentCommand,
    recovered: boolean,
  ): Promise<GameCommandResult> {
    let commandResult: GameCommandResult | null = null;

    try {
      const source = input.source ?? 'player';

      const state = await this.gameStateService.update(
        input.gameId,
        (state) => {
          const commandTurnNumber = state.turnNumber;
          const commandTurnRoomPlayerId = state.currentTurnRoomPlayerId;
          const intent = this.getEffectiveIntentForCurrentTime(
            state,
            input.intent,
          );
          const engineResult = reduceGameEngineIntent(state, intent);
          const actorRoomPlayerId = this.getIntentActorRoomPlayerId(
            intent,
          );
          const sourceAppliedState = this.applyCommandSourceToState(
            engineResult.state,
            source,
            actorRoomPlayerId,
            commandTurnRoomPlayerId,
            commandTurnNumber,
          );
          const nextState = this.applyTurnDeadline(
            state,
            sourceAppliedState,
          );

          commandResult = {
            state: nextState,
            events: engineResult.events,
            intentType: intent.type,
          };

          return nextState;
        },
      );

      const result = commandResult ?? {
        state,
        events: [],
        intentType: input.intent.type,
      };

      this.recordCommandSucceeded(
        result.intentType,
        input.gameId,
        input.roomPlayerId,
        result,
      );

      await this.afterSuccessfulCommand(input.gameId, result);

      return result;
    } catch (error) {
      if (!recovered && error instanceof NotFoundException) {
        await this.gameRecoveryService.recoverOrThrow(input.gameId);
        return this.executeIntentWithRecovery(input, true);
      }

      this.recordCommandFailed(
        input.intent.type,
        input.gameId,
        input.roomPlayerId,
        error,
      );

      throw error;
    }
  }

  private getEffectiveIntentForCurrentTime(
    state: GameEngineState,
    intent: GameEngineIntent,
  ): GameEngineIntent {
    if (
      intent.type === 'finish_game_by_time' ||
      state.phase === 'finished' ||
      state.phase === 'cancelled' ||
      !state.expiresAt
    ) {
      return intent;
    }

    const now = Date.now();

    if (now < state.expiresAt) {
      return intent;
    }

    return {
      type: 'finish_game_by_time',
      payload: {
        finishedAt: now,
      },
    };
  }

  private applyCommandSourceToState(
    state: GameCommandResult['state'],
    source: GameCommandSource,
    actorRoomPlayerId: string | null,
    commandTurnRoomPlayerId: string,
    commandTurnNumber: number,
  ): GameCommandResult['state'] {
    if (!actorRoomPlayerId) {
      return state;
    }

    if (source === 'timer') {
      if (actorRoomPlayerId !== commandTurnRoomPlayerId) {
        return state;
      }

      return incrementMissedTurn(state, actorRoomPlayerId, commandTurnNumber);
    }

    if (source === 'player') {
      return resetMissedTurn(state, actorRoomPlayerId);
    }

    return state;
  }

  private applyTurnDeadline(
    previousState: GameEngineState,
    nextState: GameEngineState,
  ): GameEngineState {
    if (nextState.phase === 'finished' || nextState.phase === 'cancelled') {
      return {
        ...nextState,
        turnExpiresAt: null,
      };
    }

    const now = Date.now();
    const isSameTurn =
      previousState.turnNumber === nextState.turnNumber &&
      previousState.currentTurnRoomPlayerId ===
        nextState.currentTurnRoomPlayerId;
    const previousTurnExpiresAt = previousState.turnExpiresAt;
    const previousDeadlineIsValid =
      previousTurnExpiresAt !== null &&
      previousTurnExpiresAt !== undefined &&
      previousTurnExpiresAt > now;

    if (isSameTurn && previousDeadlineIsValid) {
      return {
        ...nextState,
        turnExpiresAt: nextState.expiresAt
          ? Math.min(previousTurnExpiresAt, nextState.expiresAt)
          : previousTurnExpiresAt,
      };
    }

    const nextTurnExpiresAt = Date.now() + GAME_TURN_TIMER.timeoutMs;

    return {
      ...nextState,
      turnExpiresAt: nextState.expiresAt
        ? Math.min(nextTurnExpiresAt, nextState.expiresAt)
        : nextTurnExpiresAt,
    };
  }

  private async afterSuccessfulCommand(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    await this.appendEventsAfterCommand(gameId, result);
    await this.createSnapshotAfterCommand(gameId, result.state);
    await this.finalizeGameIfFinished(gameId, result);
  }

  private async appendEventsAfterCommand(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    try {
      await this.gameEventsService.appendEvents(gameId, result.events);
    } catch {
      // Event-log failure should not undo a successful Redis state mutation.
    }
  }

  private async createSnapshotAfterCommand(
    gameId: string,
    state: GameCommandResult['state'],
  ): Promise<void> {
    try {
      await this.gameSnapshotService.createSnapshotAfterCommand(gameId, state);
    } catch {
      // Snapshot failure should not undo a successful Redis state mutation.
    }
  }

  private async finalizeGameIfFinished(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    if (result.state.phase !== 'finished') {
      return;
    }

    await this.gameResultsService.finalizeFinishedGame({
      gameId,
      state: result.state,
      events: result.events,
    });
  }

  private assertIntentActorMatchesCommand(
    input: ExecuteGameIntentCommand,
  ): void {
    const actorRoomPlayerId = this.getIntentActorRoomPlayerId(input.intent);

    if (!actorRoomPlayerId) {
      return;
    }

    if (!input.roomPlayerId || actorRoomPlayerId !== input.roomPlayerId) {
      throw new BadRequestException('Invalid game command');
    }
  }

  private getIntentActorRoomPlayerId(intent: GameEngineIntent): string | null {
    switch (intent.type) {
      case 'roll_and_move':
      case 'buy_property':
      case 'decline_property_purchase':
      case 'place_auction_bid':
      case 'pass_auction_bid':
      case 'build_property':
      case 'sell_building':
      case 'mortgage_property':
      case 'unmortgage_property':
      case 'propose_trade':
      case 'accept_trade':
      case 'reject_trade':
      case 'cancel_trade':
      case 'declare_bankruptcy':
      case 'pay_debt':
      case 'pay_jail_fine':
      case 'use_get_out_of_jail_card':
      case 'end_turn':
        return intent.payload.roomPlayerId;

      case 'finish_game_by_time':
      case 'finish_game_after_last_human_left':
        return null;
    }
  }

  private recordCommandSucceeded(
    command: string,
    gameId: string,
    roomPlayerId: string | undefined,
    result: GameCommandResult,
  ): void {
    this.observabilityService.recordEvent(GAME_EVENTS.commandSucceeded, {
      gameId,
      roomPlayerId,
      command,
      mode: result.state.mode,
      phase: result.state.phase,
      turnNumber: result.state.turnNumber,
      eventCount: result.events.length,
    });

    this.observabilityService.recordMetric(
      GAME_METRICS.commandSucceeded(command),
    );
  }

  private recordCommandFailed(
    command: string,
    gameId: string,
    roomPlayerId: string | undefined,
    error: unknown,
  ): void {
    this.observabilityService.recordEvent(GAME_EVENTS.commandFailed, {
      gameId,
      roomPlayerId,
      command,
      errorCode: error instanceof GameEngineError ? error.code : undefined,
      errorName: error instanceof Error ? error.name : undefined,
    });

    this.observabilityService.recordMetric(GAME_METRICS.commandFailed(command));
  }
}
