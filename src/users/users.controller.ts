import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Req } from '@nestjs/common';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMe(@AuthUserDecorator() authUser: AuthUser, @Req() request: Request) {
    return this.usersService.getMe(authUser, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  updateMe(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: UpdateUserDto,
    @Req() request: Request,
  ) {
    return this.usersService.updateMe(authUser, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @UseGuards(AuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(
    @AuthUserDecorator() authUser: AuthUser,
    @Req() request: Request,
  ) {
    await this.usersService.deleteMe(authUser, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Get(':username')
  @HttpCode(HttpStatus.OK)
  getByUsername(@Param('username') username: string, @Req() request: Request) {
    return this.usersService.getByUsername(username, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
