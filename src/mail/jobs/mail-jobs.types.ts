export type SendOtpMailJob = {
  email: string;
  otpCode: string;
};

export type SendAccountDeletedMailJob = {
  email: string;
  username: string;
};

export type MailJob = SendOtpMailJob | SendAccountDeletedMailJob;
