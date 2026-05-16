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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UsersDocs } from './docs/users.swagger';
import {
  ConfirmAvatarUploadDto,
  CreateAvatarUploadUrlDto,
} from './dto/avatar.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersMediaService } from './services/users-media.service';
import { UsersProfileService } from './services/users-profile.service';

@UsersDocs.Controller()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersProfileService: UsersProfileService,
    private readonly usersMediaService: UsersMediaService,
  ) {}

  @UsersDocs.GetMe()
  @UseGuards(AuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMe(@AuthUserDecorator() authUser: AuthUser, @Req() request: Request) {
    return this.usersProfileService.getMe(authUser, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @UsersDocs.UpdateMe()
  @UseGuards(AuthGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  updateMe(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: UpdateUserDto,
    @Req() request: Request,
  ) {
    return this.usersProfileService.updateMe(authUser, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @UsersDocs.DeleteMe()
  @UseGuards(AuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(
    @AuthUserDecorator() authUser: AuthUser,
    @Req() request: Request,
  ) {
    await this.usersProfileService.deleteMe(authUser, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @UsersDocs.CreateAvatarUploadUrl()
  @UseGuards(AuthGuard)
  @Post('me/avatar/upload-url')
  @HttpCode(HttpStatus.OK)
  createAvatarUploadUrl(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: CreateAvatarUploadUrlDto,
    @Req() request: Request,
  ) {
    return this.usersMediaService.createAvatarUploadUrl(authUser, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @UsersDocs.ConfirmAvatarUpload()
  @UseGuards(AuthGuard)
  @Post('me/avatar/confirm')
  @HttpCode(HttpStatus.OK)
  confirmAvatarUpload(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: ConfirmAvatarUploadDto,
    @Req() request: Request,
  ) {
    return this.usersMediaService.confirmAvatarUpload(authUser, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @UsersDocs.GetByUsername()
  @Get(':username')
  @HttpCode(HttpStatus.OK)
  getByUsername(@Param('username') username: string, @Req() request: Request) {
    return this.usersProfileService.getByUsername(username, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
