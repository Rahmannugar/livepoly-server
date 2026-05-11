import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import {
  ResendEmailVerificationDto,
  VerifyEmailDto,
} from './dto/verify-email.dto';
import { AUTH } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshCookie(response: Response, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: AUTH.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });
  }

  private clearRefreshCookie(response: Response) {
    const isProduction = process.env.NODE_ENV === 'production';

    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/auth/refresh',
    });
  }

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() request: Request) {
    return this.authService.verifyEmail(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.OK)
  resendEmailVerification(
    @Body() dto: ResendEmailVerificationDto,
    @Req() request: Request,
  ) {
    return this.authService.resendEmailVerification(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    this.setRefreshCookie(response, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      request.cookies?.refreshToken,
    );

    this.setRefreshCookie(response, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(request.cookies?.refreshToken);

    this.clearRefreshCookie(response);

    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Get('oauth/google')
  async startGoogleOAuth(@Res() response: Response) {
    const url = await this.authService.getGoogleOAuthUrl();
    return response.redirect(url);
  }

  @Get('oauth/google/callback')
  async handleGoogleOAuthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const result = await this.authService.handleGoogleOAuthCallback(
        code,
        state,
        {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        },
      );

      this.setRefreshCookie(response, result.refreshToken);
      return response.redirect(result.redirectUrl);
    } catch {
      return response.redirect(this.authService.getOAuthFailureRedirectUrl());
    }
  }

  @Get('oauth/discord')
  async startDiscordOAuth(@Res() response: Response) {
    const url = await this.authService.getDiscordOAuthUrl();
    return response.redirect(url);
  }

  @Get('oauth/discord/callback')
  async handleDiscordOAuthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const result = await this.authService.handleDiscordOAuthCallback(
        code,
        state,
        {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        },
      );

      this.setRefreshCookie(response, result.refreshToken);
      return response.redirect(result.redirectUrl);
    } catch {
      return response.redirect(this.authService.getOAuthFailureRedirectUrl());
    }
  }
}
