import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../dto/password-reset.dto';
import { SignupDto } from '../dto/signup.dto';
import {
  ResendEmailVerificationDto,
  VerifyEmailDto,
} from '../dto/verify-email.dto';
import { AuthTokenResponseDto } from './auth-response.dto';

const messageResponseSchema = (message: string) => ({
  schema: {
    example: {
      success: true,
      data: { message },
      meta: {
        statusCode: 200,
        requestId: 'b0a45b42-6cd4-4c33-a8b4-f969cba8aed0',
      },
    },
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          message: { type: 'string', example: message },
        },
        required: ['message'],
      },
      meta: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 200 },
          requestId: {
            type: 'string',
            example: 'b0a45b42-6cd4-4c33-a8b4-f969cba8aed0',
          },
        },
        required: ['statusCode', 'requestId'],
      },
    },
    required: ['success', 'data', 'meta'],
  },
});

export const AuthDocs = {
  Controller: () => applyDecorators(ApiTags('Auth')),

  Signup: () =>
    applyDecorators(
      ApiOperation({ summary: 'Sign up a new user and send email OTP' }),
      ApiBody({
        type: SignupDto,
        examples: {
          valid: {
            summary: 'Sign up with email, username, and password',
            value: {
              email: 'player@example.com',
              username: 'rahmannugar',
              password: 'StrongPass123',
            },
          },
        },
      }),
      ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Verification code sent',
        ...messageResponseSchema('Verification code sent'),
      }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Email or username already exists',
      }),
    ),

  VerifyEmail: () =>
    applyDecorators(
      ApiOperation({ summary: 'Verify user email with OTP' }),
      ApiBody({
        type: VerifyEmailDto,
        examples: {
          valid: {
            summary: 'Verify email',
            value: {
              email: 'player@example.com',
              otpCode: '123456',
            },
          },
        },
      }),
      ApiOkResponse({
        description: 'Email verified',
        ...messageResponseSchema('Email verified'),
      }),
    ),

  ResendEmailVerification: () =>
    applyDecorators(
      ApiOperation({ summary: 'Resend email verification OTP' }),
      ApiBody({
        type: ResendEmailVerificationDto,
        examples: {
          valid: {
            summary: 'Resend email verification OTP',
            value: {
              email: 'player@example.com',
            },
          },
        },
      }),
      ApiOkResponse({
        description:
          'If this email belongs to a LivePoly account, a verification code will be sent',
        ...messageResponseSchema(
          'If this email belongs to a LivePoly account, a verification code will be sent',
        ),
      }),
    ),

  Login: () =>
    applyDecorators(
      ApiOperation({ summary: 'Login with email and password' }),
      ApiBody({
        type: LoginDto,
        examples: {
          valid: {
            summary: 'Login',
            value: {
              email: 'player@example.com',
              password: 'StrongPass123',
            },
          },
        },
      }),
      ApiOkResponse({
        description: 'Access token returned and refresh cookie set',
        type: AuthTokenResponseDto,
      }),
    ),

  Refresh: () =>
    applyDecorators(
      ApiOperation({ summary: 'Rotate refresh token and issue access token' }),
      ApiCookieAuth('refreshToken'),
      ApiOkResponse({
        description: 'Access token returned and refresh cookie rotated',
        type: AuthTokenResponseDto,
      }),
    ),

  Logout: () =>
    applyDecorators(
      ApiOperation({ summary: 'Logout current refresh session' }),
      ApiCookieAuth('refreshToken'),
      ApiOkResponse({
        description: 'User logged out',
        ...messageResponseSchema('User logged out'),
      }),
    ),

  ForgotPassword: () =>
    applyDecorators(
      ApiOperation({ summary: 'Send password reset OTP if email exists' }),
      ApiBody({
        type: ForgotPasswordDto,
        examples: {
          valid: {
            summary: 'Request password reset OTP',
            value: {
              email: 'player@example.com',
            },
          },
        },
      }),
      ApiOkResponse({
        description:
          'If this email belongs to a LivePoly account, a password reset code will be sent',
        ...messageResponseSchema(
          'If this email belongs to a LivePoly account, a password reset code will be sent',
        ),
      }),
    ),

  ResetPassword: () =>
    applyDecorators(
      ApiOperation({ summary: 'Reset password with OTP and revoke sessions' }),
      ApiBody({
        type: ResetPasswordDto,
        examples: {
          valid: {
            summary: 'Reset password',
            value: {
              email: 'player@example.com',
              otpCode: '123456',
              password: 'NewStrongPass123',
            },
          },
        },
      }),
      ApiOkResponse({
        description: 'Password reset successful',
        ...messageResponseSchema('Password reset successful'),
      }),
    ),

  StartGoogleOAuth: () =>
    applyDecorators(
      ApiOperation({ summary: 'Start Google OAuth browser redirect flow' }),
      ApiFoundResponse({
        description: 'Redirects to Google OAuth consent screen',
      }),
    ),

  GoogleOAuthCallback: () =>
    applyDecorators(
      ApiOperation({ summary: 'Google OAuth callback' }),
      ApiQuery({
        name: 'code',
        required: true,
        example: '4/0AVMBsJ...',
        description: 'Authorization code returned by Google',
      }),
      ApiQuery({
        name: 'state',
        required: true,
        example: 'u04swrQl8f...',
        description: 'State generated by the backend before redirect',
      }),
      ApiFoundResponse({
        description:
          'Sets refresh cookie then redirects to frontend success or failure URL',
      }),
    ),

  StartDiscordOAuth: () =>
    applyDecorators(
      ApiOperation({ summary: 'Start Discord OAuth browser redirect flow' }),
      ApiFoundResponse({
        description: 'Redirects to Discord OAuth consent screen',
      }),
    ),

  DiscordOAuthCallback: () =>
    applyDecorators(
      ApiOperation({ summary: 'Discord OAuth callback' }),
      ApiQuery({
        name: 'code',
        required: true,
        example: 'discord_authorization_code',
        description: 'Authorization code returned by Discord',
      }),
      ApiQuery({
        name: 'state',
        required: true,
        example: 'u04swrQl8f...',
        description: 'State generated by the backend before redirect',
      }),
      ApiFoundResponse({
        description:
          'Sets refresh cookie then redirects to frontend success or failure URL',
      }),
    ),
};
