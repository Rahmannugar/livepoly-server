import type { SendMailInput } from './mail.types';

type MailTemplate = Omit<SendMailInput, 'to'>;

export function emailVerificationOtpTemplate(otpCode: string): MailTemplate {
  return {
    subject: 'Verify your LivePoly account',
    text: [
      `Your LivePoly verification code is ${otpCode}.`,
      'It expires in 15 minutes.',
      '',
      'If you did not create a LivePoly account, you can ignore this email.',
    ].join('\n'),
    html: otpEmail({
      title: 'Verify your LivePoly account',
      eyebrow: 'Email verification',
      intro:
        'Use this code to finish setting up your account and join the table.',
      otpCode,
      expiryCopy: 'This code expires in 15 minutes.',
      footerCopy:
        'If you did not create a LivePoly account, you can ignore this email.',
    }),
  };
}

export function passwordResetOtpTemplate(otpCode: string): MailTemplate {
  return {
    subject: 'Reset your LivePoly password',
    text: [
      `Your LivePoly password reset code is ${otpCode}.`,
      'It expires in 5 minutes.',
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: otpEmail({
      title: 'Reset your LivePoly password',
      eyebrow: 'Password reset',
      intro: 'Use this code to choose a new password for your account.',
      otpCode,
      expiryCopy: 'This code expires in 5 minutes.',
      footerCopy: 'If you did not request this, you can ignore this email.',
    }),
  };
}

export function accountDeletedTemplate(username: string): MailTemplate {
  return {
    subject: 'Your LivePoly account was deleted',
    text: `Hello ${username},

Your LivePoly account has been deleted.

If this was not you, please contact support immediately.`,
    html: noticeEmail({
      title: 'Your LivePoly account was deleted',
      eyebrow: 'Account update',
      greeting: `Hello ${username},`,
      body: 'Your LivePoly account has been deleted.',
      footerCopy: 'If this was not you, please contact support immediately.',
    }),
  };
}

function otpEmail({
  title,
  eyebrow,
  intro,
  otpCode,
  expiryCopy,
  footerCopy,
}: {
  title: string;
  eyebrow: string;
  intro: string;
  otpCode: string;
  expiryCopy: string;
  footerCopy: string;
}) {
  return emailShell({
    title,
    eyebrow,
    body: `
      <p style="margin:0 0 20px;color:#426166;font-size:16px;line-height:1.6;">${escapeHtml(
        intro,
      )}</p>
      <div style="margin:0 0 20px;padding:18px 20px;border:1px solid #c7ddd8;border-radius:16px;background:#f2fbf7;text-align:center;">
        <p style="margin:0 0 8px;color:#6b8588;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">Your code</p>
        <p style="margin:0;color:#173a40;font-size:34px;font-weight:900;letter-spacing:.28em;">${escapeHtml(
          otpCode,
        )}</p>
      </div>
      <p style="margin:0;color:#426166;font-size:14px;line-height:1.6;">${escapeHtml(
        expiryCopy,
      )}</p>
    `,
    footerCopy,
  });
}

function noticeEmail({
  title,
  eyebrow,
  greeting,
  body,
  footerCopy,
}: {
  title: string;
  eyebrow: string;
  greeting: string;
  body: string;
  footerCopy: string;
}) {
  return emailShell({
    title,
    eyebrow,
    body: `
      <p style="margin:0 0 14px;color:#173a40;font-size:16px;font-weight:800;line-height:1.6;">${escapeHtml(
        greeting,
      )}</p>
      <p style="margin:0;color:#426166;font-size:16px;line-height:1.6;">${escapeHtml(
        body,
      )}</p>
    `,
    footerCopy,
  });
}

function emailShell({
  title,
  eyebrow,
  body,
  footerCopy,
}: {
  title: string;
  eyebrow: string;
  body: string;
  footerCopy: string;
}) {
  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;background:#e7f3ec;padding:28px 16px;font-family:Inter,Arial,sans-serif;color:#173a40;">
        <main style="max-width:520px;margin:0 auto;border:1px solid #c7ddd8;border-radius:24px;background:#ffffff;box-shadow:0 22px 70px rgba(8,28,32,.12);overflow:hidden;">
          <section style="padding:28px 28px 24px;">
            <p style="margin:0 0 10px;color:#5fcfba;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;">${escapeHtml(
              eyebrow,
            )}</p>
            <h1 style="margin:0 0 18px;color:#173a40;font-size:28px;line-height:1.15;">${escapeHtml(
              title,
            )}</h1>
            ${body}
          </section>
          <section style="border-top:1px solid #d9e9e4;padding:18px 28px;background:#f8fcfa;">
            <p style="margin:0;color:#6b8588;font-size:13px;line-height:1.6;">${escapeHtml(
              footerCopy,
            )}</p>
          </section>
        </main>
      </body>
    </html>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
