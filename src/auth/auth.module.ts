import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../infra/database/database.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { OtpModule } from '../otp/otp.module';
import { SessionModule } from '../session/session.module';
import { OAuthStateService } from './oauth-state.service';
import { AuthTokenVersionCacheService } from './auth-token-version-cache.service';
import { OAuthClientService } from './oauth-client.service';
import { CacheModule } from '../infra/cache/cache.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    MailModule,
    RateLimitModule,
    ObservabilityModule,
    OtpModule,
    SessionModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    OAuthStateService,
    OAuthClientService,
    AuthTokenVersionCacheService,
    AuthGuard,
  ],
  exports: [AuthGuard, AuthRepository, JwtModule],
})
export class AuthModule {}
