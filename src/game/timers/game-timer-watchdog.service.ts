import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GameBotQueueService } from '../bots/game-bot-queue.service';
import { GameCommandsService } from '../commands/game-commands.service';
import type { GameEngineState } from '../engine/game-engine.types';
import { GAME_EVENTS, GAME_METRICS, GAME_TIMER_WATCHDOG } from '../game.constants';
import { GameRealtimePublisher } from '../realtime/game-realtime.publisher';
import { GameRecoveryService } from '../recovery/game-recovery.service';
import { GameResultsService } from '../results/game-results.service';
import { GameTurnTimerQueueService } from './game-turn-timer-queue.service';
import { GameTimerWatchdogRepository } from './game-timer-watchdog.repository';

@Injectable()
export class GameTimerWatchdogService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private scanInProgress = false;

  constructor(
    private readonly gameTimerWatchdogRepository: GameTimerWatchdogRepository,
    private readonly gameRecoveryService: GameRecoveryService,
    private readonly gameBotQueueService: GameBotQueueService,
    private readonly gameTurnTimerQueueService: GameTurnTimerQueueService,
    private readonly gameCommandsService: GameCommandsService,
    private readonly gameResultsService: GameResultsService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly observabilityService: ObservabilityService,
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
      const candidates =
        await this.gameTimerWatchdogRepository.listActiveGames(
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

          if (joinedHumanCount === 0) {
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

          await this.gameBotQueueService.enqueueIfBotCanAct(candidate.id, state);
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
          this.observabilityService.recordEvent(GAME_EVENTS.timerWatchdogFailed, {
            gameId: candidate.id,
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : undefined,
          });
          this.observabilityService.recordMetric(
            GAME_METRICS.timerWatchdogFailed,
          );
        }
      }

      this.observabilityService.recordEvent(GAME_EVENTS.timerWatchdogCompleted, {
        scannedCount: candidates.length,
        botJobsEnsured,
        turnTimersEnsured,
        expiryJobsEnsured,
        recoveryFailures,
      });
      this.observabilityService.recordMetric(
        GAME_METRICS.timerWatchdogCompleted,
      );
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

  private isTerminal(state: GameEngineState): boolean {
    return state.phase === 'finished' || state.phase === 'cancelled';
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
