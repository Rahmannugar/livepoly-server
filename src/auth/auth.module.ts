import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule, MailModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}
