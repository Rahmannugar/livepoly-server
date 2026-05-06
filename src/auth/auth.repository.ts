import { Injectable } from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { otpTokens, users } from '../database/schema';

type CreateUserWithEmailOtpInput = {
  email: string;
  username: string;
  passwordHash: string;
  otpHash: string;
  otpExpiresAt: Date;
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

  async createUserWithEmailOtp(input: CreateUserWithEmailOtpInput) {
    return this.databaseService.db.transaction(async (tx) => {
      const [user] = await tx
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

      await tx.insert(otpTokens).values({
        userId: user.id,
        purpose: 'email_verification',
        otpHash: input.otpHash,
        expiresAt: input.otpExpiresAt,
      });

      return user;
    });
  }
}
