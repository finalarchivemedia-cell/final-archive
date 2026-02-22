import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../config/env';

const bodySchema = z.object({
    email: z.string().email(),
    message: z.string().min(2).max(2000),
});

/** Build a clean, branded HTML email for contact form submissions */
const buildHtmlEmail = (email: string, message: string): string => {
    // Escape HTML to prevent injection
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeEmail = esc(email);
    const safeMessage = esc(message).replace(/\n/g, '<br />');

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Final Archive — Contact</title>
</head>
<body style="margin:0; padding:0; background-color:#0a0a0a; font-family:'Georgia','Times New Roman',serif; color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#111111; border:1px solid rgba(255,255,255,0.08); border-radius:2px;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px 36px; border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px; letter-spacing:0.25em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:6px;">
                New Contact Message
              </div>
              <div style="font-size:22px; font-weight:normal; color:#e0e0e0; letter-spacing:0.02em; font-style:italic;">
                Final Archive
              </div>
            </td>
          </tr>

          <!-- From -->
          <tr>
            <td style="padding:28px 36px 0 36px;">
              <div style="font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:8px;">
                From
              </div>
              <div style="font-size:15px; color:#ffffff;">
                <a href="mailto:${safeEmail}" style="color:#8ab4f8; text-decoration:none;">${safeEmail}</a>
              </div>
            </td>
          </tr>

          <!-- Date -->
          <tr>
            <td style="padding:20px 36px 0 36px;">
              <div style="font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:8px;">
                Received
              </div>
              <div style="font-size:13px; color:rgba(255,255,255,0.5);">
                ${dateStr} &middot; ${timeStr}
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <div style="border-top:1px solid rgba(255,255,255,0.06);"></div>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <div style="font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:12px;">
                Message
              </div>
              <div style="font-size:15px; line-height:1.7; color:rgba(255,255,255,0.85); white-space:pre-wrap;">
                ${safeMessage}
              </div>
            </td>
          </tr>

          <!-- Reply Button -->
          <tr>
            <td style="padding:32px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#ffffff; border-radius:1px;">
                    <a href="mailto:${safeEmail}" style="display:inline-block; padding:12px 32px; font-size:11px; font-weight:bold; letter-spacing:0.2em; text-transform:uppercase; color:#000000; text-decoration:none; font-family:'Helvetica Neue',Arial,sans-serif;">
                      Reply
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px 36px; border-top:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:10px; letter-spacing:0.15em; color:rgba(255,255,255,0.2); text-align:center;">
                FinalArchiveMedia.com &nbsp;&middot;&nbsp; For All Eternity
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};

export const contactRoutes: FastifyPluginAsyncZod = async (app) => {
    app.post('/contact', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '1 minute',
            },
        },
        schema: {
            body: bodySchema,
            response: {
                200: z.object({ ok: z.literal(true) }),
                503: z.object({ ok: z.literal(false), error: z.string() }),
            },
        },
    }, async (req, reply) => {
        const { email, message } = req.body;

        // Email provider: Resend (recommended). If not configured, fail gracefully.
        if (!env.RESEND_API_KEY) {
            return reply.code(503).send({
                ok: false as const,
                error: 'Email service is not configured (missing RESEND_API_KEY).'
            });
        }

        const to = env.CONTACT_TO || 'Contact@FinalArchiveMedia.com';
        const from = env.CONTACT_FROM || 'Final Archive <onboarding@resend.dev>';

        const subject = `Final Archive Contact — ${email}`;
        const text = `From: ${email}\n\nMessage:\n${message}\n`;
        const html = buildHtmlEmail(email, message);

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to,
                reply_to: email,
                subject,
                text,
                html,
            }),
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            req.log.error({ status: res.status, errText }, 'Contact email failed');
            return reply.code(503).send({
                ok: false as const,
                error: 'Failed to send message. Please try again later.',
            });
        }

        return { ok: true as const };
    });
};
