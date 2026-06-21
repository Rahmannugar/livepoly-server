import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { CacheService } from '../../infra/cache/cache.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GameBotQueueService } from '../bots/game-bot-queue.service';
import { GameBotService } from '../bots/game-bot.service';
import { GameCommandsService } from '../commands/game-commands.service';
import type { GameCommandResult } from '../commands/game-commands.types';
import type { GameEngineState } from '../engine/game-engine.types';
import {
  GAME_EVENTS,
  GAME_METRICS,
  GAME_TIMER_WATCHDOG,
} from '../game.constants';
import { GameRealtimePublisher } from '../realtime/game-realtime.publisher';
import { GameRecoveryService } from '../recovery/game-recovery.service';
import { GameResultsService } from '../results/game-results.service';
import { GameTurnTimerQueueService } from './game-turn-timer-queue.service';
import { GameTimerWatchdogRepository } from './game-timer-watchdog.repository';

@Injectable()
export class GameTimerWatchdogService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(GameTimerWatchdogService.name);
  private static readonly SCAN_LOCK_KEY = 'worker:singleton:game-watchdog';
  private static readonly SCAN_LOCK_TTL_SECONDS = 30;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private scanInProgress = false;

  constructor(
    private readonly gameTimerWatchdogRepository: GameTimerWatchdogRepository,
    private readonly gameRecoveryService: GameRecoveryService,
    private readonly gameBotQueueService: GameBotQueueService,
    private readonly gameBotService: GameBotService,
    private readonly gameTurnTimerQueueService: GameTurnTimerQueueService,
    private readonly gameCommandsService: GameCommandsService,
    private readonly gameResultsService: GameResultsService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly observabilityService: ObservabilityService,
    private readonly cacheService: CacheService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runOnce();

    this.intervalId = setInterval(() => {
      void this.runOnce();
    }, GAME_TIMER_WATCHDOG.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async runOnce(): Promise<void> {
    if (this.scanInProgress) {
      return;
    }

    this.scanInProgress = true;

    try {
      const lockResult = await this.cacheService.withLockOrSkip({
        key: GameTimerWatchdogService.SCAN_LOCK_KEY,
        ttlSeconds: GameTimerWatchdogService.SCAN_LOCK_TTL_SECONDS,
        callback: () => this.scanActiveGames(),
      });

      if (!lockResult.acquired) {
        return;
      }
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.timerWatchdogFailed, {
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      this.observabilityService.recordMetric(GAME_METRICS.timerWatchdogFailed);
    } finally {
      this.scanInProgress = false;
    }
  }

  private async scanActiveGames(): Promise<void> {
    try {
      const candidates = await this.gameTimerWatchdogRepository.listActiveGames(
        GAME_TIMER_WATCHDOG.batchSize,
      );
      let botJobsEnsured = 0;
      let turnTimersEnsured = 0;
      let expiryJobsEnsured = 0;
      let recoveryFailures = 0;

      for (const candidate of candidates) {
        try {
          const state = await this.gameRecoveryService.getOrRecover(
            candidate.id,
          );

          const joinedHumanCount =
            await this.gameTimerWatchdogRepository.countJoinedHumanPlayers(
              candidate.roomId,
            );

          if (this.isTerminal(state)) {
            if (state.phase === 'finished') {
              if (joinedHumanCount === 0) {
                this.logger.warn({
                  message: 'game_flow.watchdog.persisting_no_human_result',
                  gameId: candidate.id,
                  roomId: candidate.roomId,
                  phase: state.phase,
                  turnNumber: state.turnNumber,
                });

                await this.gameResultsService.finalizeAbandonedFinishedGame({
                  gameId: candidate.id,
                  state,
                  finishedAt: Date.now(),
                });
              } else if (this.isGameExpired(state, candidate.expiresAt)) {
                await this.gameResultsService.finalizeExpiredFinishedGame({
                  gameId: candidate.id,
                  state,
                  finishedAt: Math.max(
                    Date.now(),
                    state.expiresAt ?? candidate.expiresAt.getTime(),
                  ),
                });
              }
            }
            continue;
          }

          if (joinedHumanCount === 0 || this.hasNoActiveHumanPlayers(state)) {
            this.logger.warn({
              message: 'game_flow.watchdog.finishing_no_active_human_game',
              gameId: candidate.id,
              roomId: candidate.roomId,
              phase: state.phase,
              turnNumber: state.turnNumber,
              joinedHumanCount,
              currentTurnRoomPlayerId: state.currentTurnRoomPlayerId,
            });

            const result = await this.gameCommandsService.executeIntent({
              gameId: candidate.id,
              source: 'timer',
              intent: {
                type: 'finish_game_after_last_human_left',
                payload: {
                  finishedAt: Date.now(),
                },
              },
            });
            await this.gameRealtimePublisher.publishCommandResult(
              candidate.id,
              result,
            );
            this.logger.log({
              message: 'game_flow.watchdog.no_active_human_finish_published',
              gameId: candidate.id,
              roomId: candidate.roomId,
              phase: result.state.phase,
              turnNumber: result.state.turnNumber,
              eventTypes: result.events.map((event) => event.type),
            });
            continue;
          }

          if (this.isGameExpired(state, candidate.expiresAt)) {
            await this.gameTurnTimerQueueService.enqueueGameExpiry(
              candidate.id,
              state.expiresAt ?? candidate.expiresAt.getTime(),
            );
            expiryJobsEnsured += 1;
            continue;
          }

          if (
            this.isTurnDeadlineOverdue(state) &&
            this.gameBotService.hasActionableBot(state)
          ) {
            const result = await this.executeOverdueBotAction(
              candidate.id,
              state,
            );
            botJobsEnsured += 1;

            await this.gameBotQueueService.enqueueIfBotCanAct(
              candidate.id,
              result.state,
            );
            await this.gameTurnTimerQueueService.enqueueTurnTimer(
              candidate.id,
              result.state,
            );
            turnTimersEnsured += 1;
            continue;
          }

          await this.gameBotQueueService.enqueueIfBotCanAct(
            candidate.id,
            state,
          );
          botJobsEnsured += 1;

          if (this.isTurnDeadlineOverdue(state)) {
            await this.gameTurnTimerQueueService.enqueueTurnTimer(
              candidate.id,
              state,
            );
            turnTimersEnsured += 1;
          }
        } catch (error) {
          recoveryFailures += 1;
          this.observabilityService.recordEvent(
            GAME_EVENTS.timerWatchdogFailed,
            {
              gameId: candidate.id,
              errorName: error instanceof Error ? error.name : undefined,
              errorMessage: error instanceof Error ? error.message : undefined,
            },
          );
          this.observabilityService.recordMetric(
            GAME_METRICS.timerWatchdogFailed,
          );
        }
      }

      this.observabilityService.recordEvent(
        GAME_EVENTS.timerWatchdogCompleted,
        {
          scannedCount: candidates.length,
          botJobsEnsured,
          turnTimersEnsured,
          expiryJobsEnsured,
          recoveryFailures,
        },
      );
      this.observabilityService.recordMetric(
        GAME_METRICS.timerWatchdogCompleted,
      );
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.timerWatchdogFailed, {
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      this.observabilityService.recordMetric(GAME_METRICS.timerWatchdogFailed);
    }
  }

  private isTerminal(state: GameEngineState): boolean {
    return state.phase === 'finished' || state.phase === 'cancelled';
  }

  private hasNoActiveHumanPlayers(state: GameEngineState): boolean {
    const hasHumanPlayers = state.players.some(
      (player) => player.playerType === 'human',
    );

    return (
      hasHumanPlayers &&
      !state.players.some(
        (player) => player.playerType === 'human' && !player.bankrupt,
      )
    );
  }

  private async executeOverdueBotAction(
    gameId: string,
    state: GameEngineState,
  ): Promise<GameCommandResult> {
    const decision = this.gameBotService.chooseDecision(state);

    if (!decision) {
      throw new Error('Watchdog found no bot decision for overdue bot action');
    }

    this.logger.warn({
      message: 'game_flow.watchdog.executing_overdue_bot_action',
      gameId,
      roomId: state.roomId,
      phase: state.phase,
      turnNumber: state.turnNumber,
      roomPlayerId: decision.roomPlayerId,
      intentType: decision.intent.type,
    });

    const result = await this.gameCommandsService.executeIntent({
      gameId,
      roomPlayerId: decision.roomPlayerId,
      source: 'bot',
      intent: decision.intent,
    });

    await this.gameRealtimePublisher.publishCommandResult(gameId, result);

    this.logger.log({
      message: 'game_flow.watchdog.overdue_bot_action_published',
      gameId,
      roomId: result.state.roomId,
      phase: result.state.phase,
      turnNumber: result.state.turnNumber,
      roomPlayerId: decision.roomPlayerId,
      intentType: result.intentType,
      eventTypes: result.events.map((event) => event.type),
    });

    return result;
  }

  private isGameExpired(state: GameEngineState, persistedExpiresAt: Date) {
    const expiresAt = state.expiresAt ?? persistedExpiresAt.getTime();

    return this.isPastGrace(expiresAt);
  }

  private isTurnDeadlineOverdue(state: GameEngineState): boolean {
    const deadline =
      state.phase === 'awaiting_auction_bid'
        ? (state.auction?.bidExpiresAt ?? state.turnExpiresAt)
        : state.turnExpiresAt;

    return deadline ? this.isPastGrace(deadline) : false;
  }

  private isPastGrace(deadline: number): boolean {
    return Date.now() - GAME_TIMER_WATCHDOG.deadlineGraceMs >= deadline;
  }
}
