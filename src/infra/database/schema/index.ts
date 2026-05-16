import * as userSchema from './user.schema';
import * as authSchema from './auth.schema';
import * as roomSchema from './room.schema';
import * as resultSchema from './result.schema';
import * as notificationSchema from './notification.schema';
import * as jobSchema from './job.schema';
import * as outboxSchema from './outbox.schema';

export * from './user.schema';
export * from './auth.schema';
export * from './room.schema';
export * from './result.schema';
export * from './notification.schema';
export * from './job.schema';
export * from './outbox.schema';

export const schema = {
  ...userSchema,
  ...authSchema,
  ...roomSchema,
  ...resultSchema,
  ...notificationSchema,
  ...jobSchema,
  ...outboxSchema,
};
