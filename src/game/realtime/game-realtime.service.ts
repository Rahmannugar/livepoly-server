import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GameBotQueueService } from '../bots/game-bot-queue.service';
import type { GameCommandResult } from '../commands/game-commands.types';
import { GameCommandsService } from '../commands/game-commands.service';
import type { DiceRoll } from '../engine/game-engine.types';
import { GAME_EVENTS, GAME_METRICS } from '../game.constants';
import { GameTurnTimerQueueService } from '../timers/game-turn-timer-queue.service';
import { GameAccessRepository } from './game-access.repository';
import { GameRealtimePublisher } from './game-realtime.publisher';
import { AuthRepository } from '../../auth/auth.repository';
import { GameEventsService } from '../events/game-events.service';
import { GameRecoveryService } from '../recovery/game-recovery.service';
import {
  GAME_LIVE_ACCESS,
  GameActorInput,
  PlaceAuctionBidInput,
  ProposeTradeInput,
  PropertyCommandInput,
  RollAndMoveInput,
  TradeDecisionInput,
} from './game-realtime.types';

@Injectable()
export class GameRealtimeService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly gameAccessRepository: GameAccessRepository,
    private readonly gameCommandsService: GameCommandsService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly gameBotQueueService: GameBotQueueService,
    private readonly gameTurnTimerQueueService: GameTurnTimerQueueService,
    private readonly gameEventsService: GameEventsService,
    private readonly gameRecoveryService: GameRecoveryService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  private async requireActivePlayer(input: GameActorInput) {
    await this.requireActiveAccount(input.userId);

    const player = await this.gameAccessRepository.findActivePlayerForGame(
      input.gameId,
      input.userId,
    );

    if (!player) {
      this.observabilityService.recordEvent(GAME_EVENTS.socketAccessDenied, {
        gameId: input.gameId,
        userId: input.userId,
      });

      throw new ForbiddenException('Game access denied');
    }

    return player;
  }

  private async requireActiveAccount(userId: string): Promise<void> {
    const user = await this.authRepository.findUserByIdForAuthToken(userId);

    if (
      !user ||
      !user.emailVerified ||
      user.status !== 'active' ||
      user.deletedAt
    ) {
      throw new UnauthorizedException('Authentication required');
    }
  }

  private async requireLiveGameAccess(input: GameActorInput) {
    await this.requireActiveAccount(input.userId);

    const player = await this.gameAccessRepository.findActivePlayerForGame(
      input.gameId,
      input.userId,
    );

    if (player) {
      return {
        access: GAME_LIVE_ACCESS.player,
        roomPlayerId: player.roomPlayerId,
      };
    }

    const spectator =
      await this.gameAccessRepository.findCurrentSpectatorForGame(
        input.gameId,
        input.userId,
      );

    if (spectator) {
      return {
        access: GAME_LIVE_ACCESS.spectator,
        spectatorId: spectator.spectatorId,
      };
    }

    this.observabilityService.recordEvent(GAME_EVENTS.socketAccessDenied, {
      gameId: input.gameId,
      userId: input.userId,
    });

    throw new ForbiddenException('Game access denied');
  }

  async joinGame(input: GameActorInput) {
    const access = await this.requireLiveGameAccess(input);
    const state = await this.gameRecoveryService.getOrRecover(input.gameId);

    await this.repairLiveGameScheduling(input.gameId, state);

    return {
      ...access,
      state,
    };
  }

  async rollAndMove(input: RollAndMoveInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.rollAndMove({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      dice: input.dice ?? this.rollDice(),
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  private rollDice(): DiceRoll {
    return [randomInt(1, 7), randomInt(1, 7)];
  }

  async endTurn(input: GameActorInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.endTurn({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async buyProperty(input: GameActorInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.buyProperty({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async declinePropertyPurchase(
    input: GameActorInput,
  ): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.declinePropertyPurchase({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async placeAuctionBid(
    input: PlaceAuctionBidInput,
  ): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.placeAuctionBid({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      amount: input.amount,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async passAuctionBid(input: GameActorInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.passAuctionBid({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async payDebt(input: GameActorInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.payDebt({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async payJailFine(input: GameActorInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.payJailFine({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async useGetOutOfJailCard(
    input: GameActorInput,
  ): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.useGetOutOfJailCard({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async declareBankruptcy(input: GameActorInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.declareBankruptcy({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async buildProperty(
    input: PropertyCommandInput,
  ): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.buildProperty({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      tileKey: input.tileKey,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async sellBuilding(
    input: PropertyCommandInput,
  ): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.sellBuilding({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      tileKey: input.tileKey,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async mortgageProperty(
    input: PropertyCommandInput,
  ): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.mortgageProperty({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      tileKey: input.tileKey,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async unmortgageProperty(
    input: PropertyCommandInput,
  ): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.unmortgageProperty({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      tileKey: input.tileKey,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async proposeTrade(input: ProposeTradeInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.proposeTrade({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      toRoomPlayerId: input.toRoomPlayerId,
      offeredCash: input.offeredCash,
      requestedCash: input.requestedCash,
      offeredPropertyKeys: input.offeredPropertyKeys,
      requestedPropertyKeys: input.requestedPropertyKeys,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async acceptTrade(input: TradeDecisionInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.acceptTrade({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      tradeId: input.tradeId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async rejectTrade(input: TradeDecisionInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.rejectTrade({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      tradeId: input.tradeId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async cancelTrade(input: TradeDecisionInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.cancelTrade({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      tradeId: input.tradeId,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
  }

  async recoverEvents(input: GameActorInput & { cursor?: string }) {
    await this.requireLiveGameAccess(input);

    return this.gameEventsService.listEvents({
      gameId: input.gameId,
      cursor: input.cursor,
    });
  }

  private async afterHumanCommandSucceeded(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    await this.publishCommandResult(gameId, result);
    await this.scheduleBotTurn(gameId, result.state);
    await this.scheduleTurnTimer(gameId, result.state);
  }

  private async publishCommandResult(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    try {
      await this.gameRealtimePublisher.publishCommandResult(gameId, result);
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.realtimePublishFailed, {
        gameId,
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(
        GAME_METRICS.realtimePublishFailed,
      );
    }
  }

  private async scheduleBotTurn(
    gameId: string,
    state: GameCommandResult['state'],
  ): Promise<void> {
    try {
      await this.gameBotQueueService.enqueueIfBotCanAct(gameId, state);
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.botTurnFailed, {
        gameId,
        phase: state.phase,
        turnNumber: state.turnNumber,
        reason: 'queue_failed',
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.botTurnFailed);
    }
  }

  private async scheduleTurnTimer(
    gameId: string,
    state: GameCommandResult['state'],
  ): Promise<void> {
    try {
      await this.gameTurnTimerQueueService.enqueueTurnTimer(gameId, state);
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerFailed, {
        gameId,
        phase: state.phase,
        turnNumber: state.turnNumber,
        reason: 'queue_failed',
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.turnTimerFailed);
    }
  }

  private async repairLiveGameScheduling(
    gameId: string,
    state: GameCommandResult['state'],
  ): Promise<void> {
    await this.scheduleBotTurn(gameId, state);
    await this.scheduleTurnTimer(gameId, state);
  }
}
