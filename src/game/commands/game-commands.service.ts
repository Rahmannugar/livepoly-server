import { Injectable } from '@nestjs/common';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GAME_COMMANDS, GAME_EVENTS, GAME_METRICS } from '../game.constants';
import { GameEngineService } from '../engine/game-engine.service';
import { GameEngineError } from '../engine/game-engine.types';
import { GameStateService } from '../state/game-state.service';
import type {
  EndTurnCommand,
  GameCommandResult,
  RollAndMoveCommand,
} from './game-commands.types';

@Injectable()
export class GameCommandsService {
  constructor(
    private readonly gameStateService: GameStateService,
    private readonly gameEngineService: GameEngineService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async rollAndMove(input: RollAndMoveCommand): Promise<GameCommandResult> {
    try {
      const state = await this.gameStateService.update(input.gameId, (state) =>
        this.gameEngineService.rollAndMove(state, {
          roomPlayerId: input.roomPlayerId,
          dice: input.dice,
        }),
      );

      this.recordCommandSucceeded(
        GAME_COMMANDS.rollAndMove,
        input.gameId,
        input.roomPlayerId,
        state,
      );

      return { state };
    } catch (error) {
      this.recordCommandFailed(
        GAME_COMMANDS.rollAndMove,
        input.gameId,
        input.roomPlayerId,
        error,
      );

      throw error;
    }
  }

  async endTurn(input: EndTurnCommand): Promise<GameCommandResult> {
    try {
      const state = await this.gameStateService.update(input.gameId, (state) =>
        this.gameEngineService.endTurn(state, {
          roomPlayerId: input.roomPlayerId,
        }),
      );

      this.recordCommandSucceeded(
        GAME_COMMANDS.endTurn,
        input.gameId,
        input.roomPlayerId,
        state,
      );

      return { state };
    } catch (error) {
      this.recordCommandFailed(
        GAME_COMMANDS.endTurn,
        input.gameId,
        input.roomPlayerId,
        error,
      );

      throw error;
    }
  }

  private recordCommandSucceeded(
    command: string,
    gameId: string,
    roomPlayerId: string,
    state: GameCommandResult['state'],
  ): void {
    this.observabilityService.recordEvent(GAME_EVENTS.commandSucceeded, {
      gameId,
      roomPlayerId,
      command,
      mode: state.mode,
      phase: state.phase,
      turnNumber: state.turnNumber,
    });

    this.observabilityService.recordMetric(
      GAME_METRICS.commandSucceeded(command),
    );
  }

  private recordCommandFailed(
    command: string,
    gameId: string,
    roomPlayerId: string,
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
