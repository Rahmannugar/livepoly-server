export const MAIL_EVENTS = {
  jobCompleted: 'MailJobCompleted',
  jobSkipped: 'MailJobSkipped',
  unknownJobReceived: 'MailUnknownJobReceived',
} as const;

export const MAIL_METRICS = {
  jobCompleted: 'Custom/Mail/Job/Completed',
  jobSkipped: 'Custom/Mail/Job/Skipped',
  unknownJobReceived: 'Custom/Mail/Job/Unknown',
} as const;
