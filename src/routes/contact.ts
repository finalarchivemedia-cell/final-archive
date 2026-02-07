import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../config/env';

const bodySchema = z.object({
    email: z.string().email(),
    message: z.string().min(2).max(2000),
});

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

