import "server-only";

/**
 * Sends email through Resend (https://resend.com) using its HTTP API.
 * Requires RESEND_API_KEY. EMAIL_FROM defaults to Resend's test sender, which
 * can only deliver to the email address that owns the Resend account.
 * Returns false when email is not configured.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Immigration History <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error("Email send failed:", res.status, await res.text());
    return false;
  }
  return true;
}
