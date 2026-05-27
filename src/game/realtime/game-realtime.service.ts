import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

type GameActorInput = {
  gameId: string;
  userId: string;
};

type RollAndMoveInput = GameActorInput & {
  dice: DiceRoll;
};

@Injectable()
export class GameRealtimeService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly gameAccessRepository: GameAccessRepository,
    private readonly gameCommandsService: GameCommandsService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly gameBotQueueService: GameBotQueueService,
    private readonly gameTurnTimerQueueService: GameTurnTimerQueueService,
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

  async joinGame(input: GameActorInput) {
    const player = await this.requireActivePlayer(input);

    return {
      roomPlayerId: player.roomPlayerId,
    };
  }

  async rollAndMove(input: RollAndMoveInput): Promise<GameCommandResult> {
    const player = await this.requireActivePlayer(input);

    const result = await this.gameCommandsService.rollAndMove({
      gameId: input.gameId,
      roomPlayerId: player.roomPlayerId,
      dice: input.dice,
    });

    await this.afterHumanCommandSucceeded(input.gameId, result);

    return result;
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

  private async afterHumanCommandSucceeded(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    await this.publishCommandResult(gameId, result);
    await this.scheduleBotTurn(gameId, result);
    await this.scheduleTurnTimer(gameId, result);
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
    result: GameCommandResult,
  ): Promise<void> {
    try {
      await this.gameBotQueueService.enqueueIfBotCanAct(gameId, result.state);
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.botTurnFailed, {
        gameId,
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
        reason: 'queue_failed',
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.botTurnFailed);
    }
  }

  private async scheduleTurnTimer(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    try {
      await this.gameTurnTimerQueueService.enqueueTurnTimer(
        gameId,
        result.state,
      );
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerFailed, {
        gameId,
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
        reason: 'queue_failed',
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.turnTimerFailed);
    }
  }
}
