import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { OtpModule } from '../otp/otp.module';
import { SessionModule } from '../session/session.module';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Module({
  imports: [
    DatabaseModule,
    MailModule,
    RateLimitModule,
    OtpModule,
    SessionModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, AuthRateLimitService],
})
export class AuthModule {}
