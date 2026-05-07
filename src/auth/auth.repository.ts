import { Injectable } from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { users } from '../database/schema';

type CreateUserInput = {
  email: string;
  username: string;
  passwordHash: string;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findUserByEmailOrUsername(email: string, username: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
      })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    return user ?? null;
  }

  async findUserByEmail(email: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async createUser(input: CreateUserInput) {
    const [user] = await this.databaseService.db
      .insert(users)
      .values({
        email: input.email,
        username: input.username,
        passwordHash: input.passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
      });

    return user;
  }

  async markEmailVerified(userId: string) {
    await this.databaseService.db
      .update(users)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}
