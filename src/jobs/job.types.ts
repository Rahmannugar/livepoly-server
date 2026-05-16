export const JOB_TYPES = {
  accountDeletedEmail: 'account_deleted_email',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export type CreateJobInput = {
  key: string;
  type: JobType;
  payload: Record<string, unknown>;
  maxAttempts?: number;
};
