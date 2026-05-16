import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { FriendsDocs } from './docs/friends.swagger';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { FriendsService } from './friends.service';

@FriendsDocs.Controller()
@UseGuards(AuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @FriendsDocs.SendRequest()
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  sendRequest(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: CreateFriendRequestDto,
    @Req() request: Request,
  ) {
    return this.friendsService.sendRequest(authUser, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @FriendsDocs.ListFriends()
  @Get()
  @HttpCode(HttpStatus.OK)
  listFriends(
    @AuthUserDecorator() authUser: AuthUser,
    @Req() request: Request,
  ) {
    return this.friendsService.listFriends(authUser, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @FriendsDocs.ListRequests()
  @Get('requests')
  @HttpCode(HttpStatus.OK)
  listRequests(
    @AuthUserDecorator() authUser: AuthUser,
    @Req() request: Request,
  ) {
    return this.friendsService.listRequests(authUser, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @FriendsDocs.AcceptRequest()
  @Post('requests/:friendshipId/accept')
  @HttpCode(HttpStatus.OK)
  acceptRequest(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('friendshipId') friendshipId: string,
    @Req() request: Request,
  ) {
    return this.friendsService.acceptRequest(authUser, friendshipId, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @FriendsDocs.RejectRequest()
  @Post('requests/:friendshipId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectRequest(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('friendshipId') friendshipId: string,
    @Req() request: Request,
  ) {
    await this.friendsService.rejectRequest(authUser, friendshipId, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @FriendsDocs.CancelRequest()
  @Post('requests/:friendshipId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelRequest(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('friendshipId') friendshipId: string,
    @Req() request: Request,
  ) {
    await this.friendsService.cancelRequest(authUser, friendshipId, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @FriendsDocs.RemoveFriend()
  @Delete(':friendshipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFriend(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('friendshipId') friendshipId: string,
    @Req() request: Request,
  ) {
    await this.friendsService.removeFriend(authUser, friendshipId, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
