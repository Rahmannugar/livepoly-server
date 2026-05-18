import { Module } from '@nestjs/common';
import { CacheModule } from '../infra/cache/cache.module';
import { GameStateService } from './state/game-state.service';

@Module({
  imports: [CacheModule],
  providers: [GameStateService],
  exports: [GameStateService],
})
export class GameModule {}
