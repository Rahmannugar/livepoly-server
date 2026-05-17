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
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { AUTH } from './auth.constants';
import { AuthService } from './auth.service';
import { AuthDocs } from './docs/auth.swagger';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { SignupDto } from './dto/signup.dto';
import {
  ResendEmailVerificationDto,
  VerifyEmailDto,
} from './dto/verify-email.dto';
import { AUTH_RATE_LIMIT_RULES } from './auth-rate-limit.rules';

@AuthDocs.Controller()
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

  @AuthDocs.Signup()
  @UseGuards(RateLimitGuard)
  @RateLimit(...AUTH_RATE_LIMIT_RULES.signup)
  @Post('signup')
  signup(@Body() dto: SignupDto, @Req() request: Request) {
    return this.authService.signup(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @AuthDocs.VerifyEmail()
  @UseGuards(RateLimitGuard)
  @RateLimit(...AUTH_RATE_LIMIT_RULES.verifyEmail)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() request: Request) {
    return this.authService.verifyEmail(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @AuthDocs.ResendEmailVerification()
  @UseGuards(RateLimitGuard)
  @RateLimit(...AUTH_RATE_LIMIT_RULES.resendEmailVerification)
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

  @AuthDocs.Login()
  @UseGuards(RateLimitGuard)
  @RateLimit(...AUTH_RATE_LIMIT_RULES.login)
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

  @AuthDocs.Refresh()
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

  @AuthDocs.Logout()
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

  @AuthDocs.ForgotPassword()
  @UseGuards(RateLimitGuard)
  @RateLimit(...AUTH_RATE_LIMIT_RULES.forgotPassword)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @AuthDocs.ResetPassword()
  @UseGuards(RateLimitGuard)
  @RateLimit(...AUTH_RATE_LIMIT_RULES.resetPassword)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @AuthDocs.StartGoogleOAuth()
  @Get('oauth/google')
  async startGoogleOAuth(@Res() response: Response) {
    const url = await this.authService.getGoogleOAuthUrl();
    return response.redirect(url);
  }

  @AuthDocs.GoogleOAuthCallback()
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

  @AuthDocs.StartDiscordOAuth()
  @Get('oauth/discord')
  async startDiscordOAuth(@Res() response: Response) {
    const url = await this.authService.getDiscordOAuthUrl();
    return response.redirect(url);
  }

  @AuthDocs.DiscordOAuthCallback()
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
