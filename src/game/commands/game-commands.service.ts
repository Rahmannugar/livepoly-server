import { Injectable } from '@nestjs/common';
import { GameEngineService } from '../engine/game-engine.service';
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
  ) {}

  async rollAndMove(input: RollAndMoveCommand): Promise<GameCommandResult> {
    const state = await this.gameStateService.update(input.gameId, (state) =>
      this.gameEngineService.rollAndMove(state, {
        roomPlayerId: input.roomPlayerId,
        dice: input.dice,
      }),
    );

    return { state };
  }

  async endTurn(input: EndTurnCommand): Promise<GameCommandResult> {
    const state = await this.gameStateService.update(input.gameId, (state) =>
      this.gameEngineService.endTurn(state, {
        roomPlayerId: input.roomPlayerId,
      }),
    );

    return { state };
  }
}
