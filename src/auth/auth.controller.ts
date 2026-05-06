import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, {
      ip: request.ip,
    });
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() request: Request) {
    return this.authService.verifyEmail(dto, {
      ip: request.ip,
    });
  }
}
