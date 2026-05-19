import { BadRequestException, Injectable } from '@nestjs/common';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GAME_EVENTS, GAME_METRICS } from '../game.constants';
import {
  reduceGameEngineIntent,
  type GameEngineIntent,
} from '../engine/game-engine-intents';
import { GameEngineError } from '../engine/game-engine.types';
import { GameStateService } from '../state/game-state.service';
import type {
  EndTurnCommand,
  ExecuteGameIntentCommand,
  GameCommandResult,
  RollAndMoveCommand,
} from './game-commands.types';

@Injectable()
export class GameCommandsService {
  constructor(
    private readonly gameStateService: GameStateService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async executeIntent(
    input: ExecuteGameIntentCommand,
  ): Promise<GameCommandResult> {
    this.assertIntentActorMatchesCommand(input);

    let commandResult: GameCommandResult | null = null;

    try {
      const state = await this.gameStateService.update(
        input.gameId,
        (state) => {
          const engineResult = reduceGameEngineIntent(state, input.intent);

          commandResult = {
            state: engineResult.state,
            events: engineResult.events,
            intentType: input.intent.type,
          };

          return engineResult.state;
        },
      );

      const result = commandResult ?? {
        state,
        events: [],
        intentType: input.intent.type,
      };

      this.recordCommandSucceeded(
        input.intent.type,
        input.gameId,
        input.roomPlayerId,
        result,
      );

      return result;
    } catch (error) {
      this.recordCommandFailed(
        input.intent.type,
        input.gameId,
        input.roomPlayerId,
        error,
      );

      throw error;
    }
  }

  async rollAndMove(input: RollAndMoveCommand): Promise<GameCommandResult> {
    return this.executeIntent({
      gameId: input.gameId,
      roomPlayerId: input.roomPlayerId,
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
      intent: {
        type: 'end_turn',
        payload: {
          roomPlayerId: input.roomPlayerId,
        },
      },
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
      case 'declare_bankruptcy':
      case 'pay_debt':
      case 'pay_jail_fine':
      case 'end_turn':
        return intent.payload.roomPlayerId;

      case 'finish_game_by_time':
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
