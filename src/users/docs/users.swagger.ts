import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateAvatarUploadUrlDto } from '../dto/avatar.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  AvatarUploadUrlResponseDto,
  UserProfileResponseDto,
} from './users-response.dto';

export const UsersDocs = {
  Controller: () => applyDecorators(ApiTags('Users')),

  GetMe: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Get current authenticated user profile' }),
      ApiOkResponse({ type: UserProfileResponseDto }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  UpdateMe: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Update current authenticated user profile' }),
      ApiBody({
        type: UpdateUserDto,
        examples: {
          updateUsernameAndBio: {
            summary: 'Update username and bio',
            value: {
              username: 'rahmannugar',
              bio: 'I bankrupt friends and foes.',
            },
          },
          clearBio: {
            summary: 'Clear bio',
            value: { bio: '' },
          },
        },
      }),
      ApiOkResponse({ type: UserProfileResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid or empty profile update',
      }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Username already exists',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  DeleteMe: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Delete current authenticated user account' }),
      ApiNoContentResponse({ description: 'User account deleted' }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  CreateAvatarUploadUrl: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Create avatar upload URL',
        description:
          'Returns a short-lived direct upload URL, updates the avatar pointer immediately, and schedules background verification after the URL expires.',
      }),
      ApiBody({
        type: CreateAvatarUploadUrlDto,
        examples: {
          webpAvatar: {
            summary: 'WebP avatar',
            value: {
              contentType: 'image/webp',
              contentLength: 5242880,
            },
          },
        },
      }),
      ApiOkResponse({ type: AvatarUploadUrlResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid avatar upload request',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  GetByUsername: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get user profile by username' }),
      ApiParam({
        name: 'username',
        example: 'rahmannugar',
      }),
      ApiOkResponse({ type: UserProfileResponseDto }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found',
      }),
    ),
};
