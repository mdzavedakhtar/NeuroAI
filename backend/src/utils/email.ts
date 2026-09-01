import nodemailer, { Transporter } from "nodemailer"
import crypto from "crypto"

// ======================================================
// TOKEN HELPERS
// ======================================================

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function hashVerificationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function buildVerificationUrl(token: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000"
  return `${appUrl}/verify-email?token=${token}`
}

// ======================================================
// TRANSPORTER (lazy singleton)
// ======================================================

let _transporter: Transporter | null = null

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  )
}

function getTransporter(): Transporter {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured")
  }

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  return _transporter
}

// ======================================================
// SEND VERIFICATION EMAIL
// ======================================================
//
// Returns true when the email was handed to the SMTP transport,
// or false when SMTP is not configured (dev mode — the caller is
// expected to surface the verification link in the response).
//
// eslint-disable-next-line @typescript-eslint/no-unused-vars

export async function sendVerificationEmail(params: {
  to: string
  name: string
  token: string
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    return false
  }

  const from = process.env.SMTP_FROM || "NeuroStack AI <no-reply@neurostack.ai>"
  const url = buildVerificationUrl(params.token)
  const appName = process.env.APP_NAME || "NeuroStack AI"

  try {
    await getTransporter().sendMail({
      from,
      to: params.to,
      subject: `Verify your ${appName} email`,
      text: `Hi ${params.name},\n\nWelcome to ${appName}! Please confirm your email address by opening the link below:\n\n${url}\n\nIf you did not create this account, you can safely ignore this email.\n\n— ${appName}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
          <h2 style="margin:0 0 8px">Welcome to ${appName} 👋</h2>
          <p style="margin:0 0 16px;color:#555">Hi ${params.name}, please confirm your email address to activate your account.</p>
          <a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Verify email</a>
          <p style="margin:24px 0 0;font-size:12px;color:#888">If the button doesn't work, copy this link:<br/><span style="word-break:break-all">${url}</span></p>
          <p style="margin:16px 0 0;font-size:12px;color:#888">If you did not create this account, you can safely ignore this email.</p>
        </div>
      `,
    })

    return true
  } catch (error) {
    console.error("[EMAIL] Failed to send verification email:", error)
    return false
  }
}
