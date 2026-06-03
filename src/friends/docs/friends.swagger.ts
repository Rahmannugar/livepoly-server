import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateFriendRequestDto } from '../dto/create-friend-request.dto';
import {
  FriendsListResponseDto,
  FriendRequestsResponseDto,
  FriendshipResponseDto,
} from './friends-response.dto';

export const FriendsDocs = {
  Controller: () => applyDecorators(ApiTags('Friends')),

  SendRequest: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Send friend request' }),
      ApiBody({
        type: CreateFriendRequestDto,
        examples: {
          byUsername: {
            summary: 'Send request by username',
            value: { username: 'friendone' },
          },
        },
      }),
      ApiCreatedResponse({ type: FriendshipResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Cannot send friend request to yourself',
      }),
      ApiResponse({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'Friend request body failed validation',
      }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Friendship already exists',
      }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  ListFriends: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'List friends' }),
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
          'eyJ2IjoxLCJmcmllbmRzaGlwSWQiOiI5YjRmMGVhNC0wZTc2LTRkZDUtODYwNi1iNjFkYzM4YjgxM2QiLCJjcmVhdGVkQXQiOiIyMDI2LTA1LTE0VDEyOjAwOjAwLjAwMFoifQ',
      }),
      ApiOkResponse({ type: FriendsListResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid friends cursor',
      }),
      ApiResponse({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'Friends query failed validation',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  ListRequests: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'List incoming and outgoing friend requests' }),
      ApiQuery({
        name: 'limit',
        required: false,
        example: 50,
        description: 'Page size from 1 to 100 for each request list',
      }),
      ApiQuery({
        name: 'incomingCursor',
        required: false,
        example:
          'eyJ2IjoxLCJmcmllbmRzaGlwSWQiOiI5YjRmMGVhNC0wZTc2LTRkZDUtODYwNi1iNjFkYzM4YjgxM2QiLCJjcmVhdGVkQXQiOiIyMDI2LTA1LTE0VDEyOjAwOjAwLjAwMFoifQ',
      }),
      ApiQuery({
        name: 'outgoingCursor',
        required: false,
        example:
          'eyJ2IjoxLCJmcmllbmRzaGlwSWQiOiI5YjRmMGVhNC0wZTc2LTRkZDUtODYwNi1iNjFkYzM4YjgxM2QiLCJjcmVhdGVkQXQiOiIyMDI2LTA1LTE0VDEyOjAwOjAwLjAwMFoifQ',
      }),
      ApiOkResponse({ type: FriendRequestsResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid friend request cursor',
      }),
      ApiResponse({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'Friend request query failed validation',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  AcceptRequest: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Accept friend request' }),
      ApiParam({
        name: 'friendshipId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiOkResponse({ type: FriendshipResponseDto }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Friend request not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  RejectRequest: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Reject friend request' }),
      ApiParam({
        name: 'friendshipId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiNoContentResponse({ description: 'Friend request rejected' }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Friend request not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  CancelRequest: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Cancel sent friend request' }),
      ApiParam({
        name: 'friendshipId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiNoContentResponse({ description: 'Friend request canceled' }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Friend request not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  RemoveFriend: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Remove friend' }),
      ApiParam({
        name: 'friendshipId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiNoContentResponse({ description: 'Friend removed' }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Friendship not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),
};
