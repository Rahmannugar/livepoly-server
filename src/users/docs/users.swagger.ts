import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateAvatarUploadUrlDto } from '../dto/avatar.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  AvatarUploadUrlResponseDto,
  UserMatchHistoryResponseDto,
  UserProfileResponseDto,
  UserSearchResponseDto,
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
        description: 'No profile updates provided',
      }),
      ApiResponse({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'Profile update body failed validation',
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
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'Avatar upload request body failed validation',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  ListMatches: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'List user match history' }),
      ApiParam({
        name: 'username',
        example: 'rahmannugar',
      }),
      ApiQuery({
        name: 'limit',
        required: false,
        example: 50,
        description: 'Page size from 1 to 100',
      }),
      ApiQuery({
        name: 'cursor',
        required: false,
        example:
          'eyJ2IjoxLCJjb21wbGV0ZWRBdCI6IjIwMjYtMDUtMTRUMTI6NDU6MDAuMDAwWiIsInJvb21SZXN1bHRJZCI6IjI1ZmM1NzdlLWE0YTktNGIyMi1iMTEzLWEwZWZhY2RjNjQ3MCJ9',
      }),
      ApiOkResponse({ type: UserMatchHistoryResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid match history cursor',
      }),
      ApiResponse({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'Match history query failed validation',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  Search: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Search users by username',
        description:
          'Returns active users whose usernames start with the provided lowercase query.',
      }),
      ApiQuery({
        name: 'query',
        required: true,
        example: 'rah',
        description: 'Username text to search for',
      }),
      ApiQuery({
        name: 'limit',
        required: false,
        example: 50,
        description: 'Page size from 1 to 100',
      }),
      ApiQuery({
        name: 'cursor',
        required: false,
        example:
          'eyJ2IjoxLCJ1c2VybmFtZSI6InJhaG1hbm51Z2FyIiwidXNlcklkIjoiN2M2ZTBmNGUtN2Y4ZC00YzE4LWEwY2YtOTA2ZjRjOGIyYjkxIn0',
      }),
      ApiOkResponse({ type: UserSearchResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid user search cursor',
      }),
      ApiResponse({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'User search query failed validation',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

};
