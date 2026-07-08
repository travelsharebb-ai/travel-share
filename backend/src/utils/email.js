import sgMail from "@sendgrid/mail";
import { prisma } from "./prisma.js";

function emailProvider() {
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  return process.env.EMAIL_PROVIDER || "console";
}

async function deliver({ to, subject, text, html }) {
  const provider = emailProvider();

  if (provider === "sendgrid") {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM,
      subject,
      text,
      html
    });
    return provider;
  }

  console.log(`[email:${provider}] ${subject} -> ${to}\n${text}`);
  return provider;
}

async function logEmail({ userId, uploadId, toEmail, template, subject, provider, status, errorMessage }) {
  await prisma.emailNotificationLog.create({
    data: {
      userId,
      uploadId,
      toEmail,
      template,
      subject,
      provider,
      status,
      errorMessage
    }
  });
}

export async function sendEmail({ userId, uploadId, toEmail, template, subject, text, html }) {
  const provider = emailProvider();

  try {
    const deliveredProvider = await deliver({ to: toEmail, subject, text, html });
    await logEmail({ userId, uploadId, toEmail, template, subject, provider: deliveredProvider, status: "sent" });
    return { sent: true };
  } catch (error) {
    await logEmail({
      userId,
      uploadId,
      toEmail,
      template,
      subject,
      provider,
      status: "failed",
      errorMessage: error.message
    });
    return { sent: false, error: error.message };
  }
}

export async function notifyNewUpload({ trip, upload }) {
  const reviewUrl = `${process.env.FRONTEND_URL}/trips/${trip.id}`;
  return sendEmail({
    userId: trip.user.id,
    uploadId: upload.id,
    toEmail: trip.user.email,
    template: "new-upload",
    subject: "New upload waiting in Travel Share",
    text: `New upload waiting! A new candid from ${trip.destination} is ready for review: ${reviewUrl}`,
    html: `<p><strong>New upload waiting!</strong></p><p>A new candid from ${trip.destination} is ready for review.</p><p><a href="${reviewUrl}">Review now</a></p>`
  });
}

export async function notifyReportedUpload({ upload }) {
  const toEmail = process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL;
  if (!toEmail) return { sent: false, error: "No admin/support email configured." };

  return sendEmail({
    userId: upload.trip.userId,
    uploadId: upload.id,
    toEmail,
    template: "reported-upload",
    subject: "Travel Share upload reported",
    text: `An upload was reported for ${upload.trip.title}. Reason: ${upload.reportReason || "Not provided"}`,
    html: `<p><strong>Travel Share upload reported</strong></p><p>${upload.trip.title}</p><p>${upload.reportReason || "Not provided"}</p>`
  });
}

export async function sendPasswordResetEmail({ user, resetUrl }) {
  return sendEmail({
    userId: user.id,
    toEmail: user.email,
    template: "password-reset",
    subject: "Reset your Travel Share password",
    text: `We received a request to reset your Travel Share password. This link expires in 30 minutes: ${resetUrl}`,
    html: `<p>We received a request to reset your Travel Share password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes.</p>`
  });
}

export async function sendEmailChangeRequest({ user, toEmail, verificationUrl }) {
  return sendEmail({
    userId: user.id,
    toEmail,
    template: "email-change",
    subject: "Confirm your new Travel Share email",
    text: `Please confirm your new email for Travel Share by visiting: ${verificationUrl}`,
    html: `<p>Please confirm your new email for Travel Share.</p><p><a href="${verificationUrl}">Confirm email</a></p><p>This link expires in one hour.</p>`
  });
}
