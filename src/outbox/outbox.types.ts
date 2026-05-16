export const OUTBOX_TOPICS = {
  notificationCreated: 'notification.created',
} as const;

export type OutboxTopic = (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];

export type CreateOutboxEventInput = {
  key: string;
  topic: OutboxTopic;
  payload: unknown;
  maxAttempts?: number;
};
