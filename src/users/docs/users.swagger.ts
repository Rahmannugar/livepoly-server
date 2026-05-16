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
import {
  ConfirmAvatarUploadDto,
  CreateAvatarUploadUrlDto,
} from '../dto/avatar.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  AvatarUploadUrlResponseDto,
  PrivateUserProfileResponseDto,
  PublicUserProfileResponseDto,
} from './users-response.dto';

export const UsersDocs = {
  Controller: () => applyDecorators(ApiTags('Users')),

  GetMe: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Get current authenticated user profile' }),
      ApiOkResponse({ type: PrivateUserProfileResponseDto }),
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
      ApiOkResponse({ type: PrivateUserProfileResponseDto }),
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
          'Returns a short-lived direct upload URL. The profile avatar is not updated until the uploaded object is confirmed.',
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

  ConfirmAvatarUpload: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Confirm avatar upload',
        description:
          'Verifies the uploaded object belongs to the authenticated user, exists in storage, has an allowed type, and is within the size limit before updating the profile avatar.',
      }),
      ApiBody({
        type: ConfirmAvatarUploadDto,
        examples: {
          confirmedAvatar: {
            summary: 'Confirm uploaded avatar',
            value: {
              objectKey:
                'avatars/7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp',
            },
          },
        },
      }),
      ApiOkResponse({ type: PrivateUserProfileResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Avatar object is invalid or was not uploaded',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  GetByUsername: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get public user profile by username' }),
      ApiParam({
        name: 'username',
        example: 'rahmannugar',
      }),
      ApiOkResponse({ type: PublicUserProfileResponseDto }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found',
      }),
    ),
};
