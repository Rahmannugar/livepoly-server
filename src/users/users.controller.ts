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
  getMe(@AuthUserDecorator() authUser: AuthUser) {
    return this.usersService.getMe(authUser);
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  updateMe(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateMe(authUser, dto);
  }

  @UseGuards(AuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@AuthUserDecorator() authUser: AuthUser) {
    await this.usersService.deleteMe(authUser);
  }

  @Get(':username')
  @HttpCode(HttpStatus.OK)
  getByUsername(@Param('username') username: string) {
    return this.usersService.getByUsername(username);
  }
}
