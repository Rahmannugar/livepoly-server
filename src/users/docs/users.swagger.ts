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
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  PrivateUserProfileResponseDto,
  PublicUserProfileResponseDto,
} from './users-response.dto';

export const UsersDocs = {
  Controller: () => applyDecorators(ApiTags('Users')),

  GetMe: () =>
    applyDecorators(
      ApiBearerAuth(),
      ApiOperation({ summary: 'Get current authenticated user profile' }),
      ApiOkResponse({
        type: PrivateUserProfileResponseDto,
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  UpdateMe: () =>
    applyDecorators(
      ApiBearerAuth(),
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
            value: {
              bio: '',
            },
          },
        },
      }),
      ApiOkResponse({
        type: PrivateUserProfileResponseDto,
      }),
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
      ApiBearerAuth(),
      ApiOperation({ summary: 'Delete current authenticated user account' }),
      ApiNoContentResponse({
        description: 'User account deleted',
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
      ApiOkResponse({
        type: PublicUserProfileResponseDto,
      }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found',
      }),
    ),
};
