import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../infra/cache/cache.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { GameCommandsService } from './commands/game-commands.service';
import { GameAccessRepository } from './realtime/game-access.repository';
import { GameGateway } from './realtime/game.gateway';
import { GameStateService } from './state/game-state.service';

@Module({
  imports: [AuthModule, CacheModule, DatabaseModule, ObservabilityModule],
  providers: [
    GameStateService,
    GameCommandsService,
    GameAccessRepository,
    GameGateway,
  ],
  exports: [GameStateService, GameCommandsService],
})
export class GameModule {}
