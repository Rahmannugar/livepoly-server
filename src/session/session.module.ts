import { Module } from '@nestjs/common';
import { CacheModule } from '../infra/cache/cache.module';
import { SessionCacheService } from './session-cache.service';

@Module({
  imports: [CacheModule],
  providers: [SessionCacheService],
  exports: [SessionCacheService],
})
export class SessionModule {}
