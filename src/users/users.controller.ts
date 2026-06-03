import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { UsersDocs } from './docs/users.swagger';
import { CreateAvatarUploadUrlDto } from './dto/avatar.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersMediaService } from './services/users-media.service';
import { UsersProfileService } from './services/users-profile.service';
import { USERS_RATE_LIMIT_RULES } from './users-rate-limit.rules';
import { ListUserMatchesDto } from './dto/list-user-matches.dto';
import { UsersStatsService } from './services/users-stats.service';
import { SearchUsersDto } from './dto/search-users.dto';

@UsersDocs.Controller()
@UseGuards(AuthGuard, RateLimitGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersProfileService: UsersProfileService,
    private readonly usersMediaService: UsersMediaService,
    private readonly usersStatsService: UsersStatsService,
  ) {}

  @UsersDocs.GetMe()
  @RateLimit(...USERS_RATE_LIMIT_RULES.getMe)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMe(@AuthUserDecorator() authUser: AuthUser) {
    return this.usersProfileService.getMe(authUser);
  }

  @UsersDocs.UpdateMe()
  @RateLimit(...USERS_RATE_LIMIT_RULES.updateMe)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  updateMe(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersProfileService.updateMe(authUser, dto);
  }

  @UsersDocs.DeleteMe()
  @RateLimit(...USERS_RATE_LIMIT_RULES.deleteMe)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@AuthUserDecorator() authUser: AuthUser) {
    await this.usersProfileService.deleteMe(authUser);
  }

  @UsersDocs.CreateAvatarUploadUrl()
  @RateLimit(...USERS_RATE_LIMIT_RULES.updateMe)
  @Post('me/avatar/upload-url')
  @HttpCode(HttpStatus.OK)
  createAvatarUploadUrl(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: CreateAvatarUploadUrlDto,
  ) {
    return this.usersMediaService.createAvatarUploadUrl(authUser, dto);
  }

  @UsersDocs.ListMatches()
  @RateLimit(...USERS_RATE_LIMIT_RULES.getMatches)
  @Get(':username/matches')
  @HttpCode(HttpStatus.OK)
  listMatches(
    @Param('username') username: string,
    @Query() dto: ListUserMatchesDto,
  ) {
    return this.usersStatsService.listMatches(username, dto);
  }

  @UsersDocs.GetByUsername()
  @RateLimit(...USERS_RATE_LIMIT_RULES.getByUsername)
  @Get(':username')
  @HttpCode(HttpStatus.OK)
  getByUsername(@Param('username') username: string) {
    return this.usersProfileService.getByUsername(username);
  }

  @UsersDocs.Search()
  @RateLimit(...USERS_RATE_LIMIT_RULES.search)
  @Get('search')
  @HttpCode(HttpStatus.OK)
  searchUsers(@Query() dto: SearchUsersDto) {
    return this.usersProfileService.searchUsers(dto);
  }
}
