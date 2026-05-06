import * as userSchema from './user.schema';
import * as authSchema from './auth.schema';
import * as roomSchema from './room.schema';

export * from './user.schema';
export * from './auth.schema';
export * from './room.schema';

export const schema = {
  ...userSchema,
  ...authSchema,
  ...roomSchema,
};
