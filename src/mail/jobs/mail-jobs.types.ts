export type SendOtpMailJob = {
  email: string;
  otpCode: string;
};

export type SendAccountDeletedMailJob = {
  jobId: string;
  userId: string;
  email: string;
  username: string;
};

export type MailJob = SendOtpMailJob | SendAccountDeletedMailJob;
