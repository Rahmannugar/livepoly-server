import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { FriendsDocs } from './docs/friends.swagger';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { FRIENDS_RATE_LIMIT_RULES } from './friends-rate-limit.rules';
import { FriendsService } from './friends.service';

@FriendsDocs.Controller()
@UseGuards(AuthGuard, RateLimitGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @FriendsDocs.SendRequest()
  @RateLimit(...FRIENDS_RATE_LIMIT_RULES.mutation)
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  sendRequest(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: CreateFriendRequestDto,
  ) {
    return this.friendsService.sendRequest(authUser, dto);
  }

  @FriendsDocs.ListFriends()
  @RateLimit(...FRIENDS_RATE_LIMIT_RULES.read)
  @Get()
  @HttpCode(HttpStatus.OK)
  listFriends(@AuthUserDecorator() authUser: AuthUser) {
    return this.friendsService.listFriends(authUser);
  }

  @FriendsDocs.ListRequests()
  @RateLimit(...FRIENDS_RATE_LIMIT_RULES.read)
  @Get('requests')
  @HttpCode(HttpStatus.OK)
  listRequests(@AuthUserDecorator() authUser: AuthUser) {
    return this.friendsService.listRequests(authUser);
  }

  @FriendsDocs.AcceptRequest()
  @RateLimit(...FRIENDS_RATE_LIMIT_RULES.mutation)
  @Post('requests/:friendshipId/accept')
  @HttpCode(HttpStatus.OK)
  acceptRequest(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendsService.acceptRequest(authUser, friendshipId);
  }

  @FriendsDocs.RejectRequest()
  @RateLimit(...FRIENDS_RATE_LIMIT_RULES.mutation)
  @Post('requests/:friendshipId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectRequest(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('friendshipId') friendshipId: string,
  ) {
    await this.friendsService.rejectRequest(authUser, friendshipId);
  }

  @FriendsDocs.CancelRequest()
  @RateLimit(...FRIENDS_RATE_LIMIT_RULES.mutation)
  @Post('requests/:friendshipId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelRequest(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('friendshipId') friendshipId: string,
  ) {
    await this.friendsService.cancelRequest(authUser, friendshipId);
  }

  @FriendsDocs.RemoveFriend()
  @RateLimit(...FRIENDS_RATE_LIMIT_RULES.mutation)
  @Delete(':friendshipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFriend(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('friendshipId') friendshipId: string,
  ) {
    await this.friendsService.removeFriend(authUser, friendshipId);
  }
}
