export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailClient = {
  sendMail(input: SendMailInput): Promise<void>;
};

export const MAIL_CLIENT = Symbol('MAIL_CLIENT');
