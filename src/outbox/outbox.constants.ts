export const OUTBOX_EVENTS = {
  jobCompleted: 'OutboxJobCompleted',
  unknownJobReceived: 'OutboxUnknownJobReceived',
  eventPublishSkipped: 'OutboxEventPublishSkipped',
  eventPublished: 'OutboxEventPublished',
  eventPublishFailed: 'OutboxEventPublishFailed',
  recoveryCompleted: 'OutboxRecoveryCompleted',
  recoveryFailed: 'OutboxRecoveryFailed',
} as const;

export const OUTBOX_METRICS = {
  jobCompleted: 'Custom/Outbox/Job/Completed',
  unknownJobReceived: 'Custom/Outbox/Job/Unknown',
  eventPublishSkipped: 'Custom/Outbox/Event/PublishSkipped',
  eventPublished: 'Custom/Outbox/Event/Published',
  eventPublishFailed: 'Custom/Outbox/Event/PublishFailed',
  recoveryCompleted: 'Custom/Outbox/Recovery/Completed',
  recoveryFailed: 'Custom/Outbox/Recovery/Failed',
} as const;
