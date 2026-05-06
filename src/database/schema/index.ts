import * as authSchema from './auth.schema';
import * as userSchema from './user.schema';

export * from './auth.schema';
export * from './user.schema';

export const schema = {
  ...authSchema,
  ...userSchema,
};
