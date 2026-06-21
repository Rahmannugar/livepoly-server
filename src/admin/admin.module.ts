import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { SessionModule } from '../session/session.module';
import { CacheModule } from '../infra/cache/cache.module';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AuthModule,
    CacheModule,
    DatabaseModule,
    ObservabilityModule,
    SessionModule,
  ],
  controllers: [AdminController],
  providers: [AdminGuard, AdminRepository, AdminService],
})
export class AdminModule {}
