import { Module } from '@nestjs/common';
import { CacheModule } from '../infra/cache/cache.module';
import { GameCommandsService } from './commands/game-commands.service';
import { GameEngineService } from './engine/game-engine.service';
import { GameStateService } from './state/game-state.service';

@Module({
  imports: [CacheModule],
  providers: [GameStateService, GameEngineService, GameCommandsService],
  exports: [GameStateService, GameCommandsService],
})
export class GameModule {}
