import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../config/env';
import { IdGenerator } from '../services/idGenerator';
import { R2Service } from '../services/r2';
import { prisma } from '../utils/prisma';

export const webhookRoutes: FastifyPluginAsyncZod = async (app) => {

    app.post('/webhook', {
        // Disable body parsing or handle raw? Fastify parses json by default which is fine for these payloads.
        schema: {
            headers: z.object({
                'x-webhook-secret': z.string()
            }).passthrough(),
            // Relaxed body schema to allow different formats, will validate logic inside
            body: z.any()
        }
    }, async (req, reply) => {
        const secret = req.headers['x-webhook-secret'];
        if (secret !== env.WEBHOOK_SECRET) {
            return reply.code(403).send({ error: 'Invalid secret' });
        }

        if (!env.ENABLE_R2_SYNC) {
            return reply.code(503).send({ error: 'R2 Sync is disabled' });
        }

        // Respond immediately
        reply.code(200).send({ received: true });

        // Async Processing
        (async () => {
            try {
                const body = req.body as any;
                const normalizeKey = (rawKey: string) => {
                    try {
                        return decodeURIComponent(rawKey.replace(/\+/g, ' '));
                    } catch {
                        return rawKey;
                }
                };

                const processKey = async (rawKey: string, eventName?: string) => {
                    const key = normalizeKey(rawKey);
                    const isRemoved = eventName?.includes('ObjectRemoved') ?? false;
                    const isCreate = !eventName || eventName.includes('ObjectCreated');

                    if (isRemoved) {
                    await prisma.image.updateMany({
                        where: { originalKey: key },
                        data: { isActive: false }
                    });
                    return;
                }

                if (!isCreate) return;

                    const mediaType = R2Service.getMediaType(key);
                    if (!mediaType) {
                        console.log(`Skipping unsupported file: ${key}`);
                    return;
                }

                const existing = await prisma.image.findUnique({
                    where: { originalKey: key }
                });

                if (existing) {
                    if (!existing.isActive) {
                        await prisma.image.update({
                            where: { id: existing.id },
                            data: { isActive: true }
                        });
                    }
                    return;
                }

                const url = `${env.CDN_BASE_URL}/${key}`;
                await IdGenerator.createImageRecord({
                    originalKey: key,
                    url: url,
                        mediaType,
                    });

                    console.log(`Successfully registered media from webhook: ${key} (${mediaType})`);
                };

                // Case 1: Simple { key: "..." }
                if (body.key && typeof body.key === 'string') {
                    await processKey(body.key, body.eventName);
                    return;
                }

                // Case 2: AWS S3 Event (may include multiple records)
                if (body.Records && Array.isArray(body.Records)) {
                    for (const record of body.Records) {
                        const recordKey = record?.s3?.object?.key;
                        if (!recordKey) continue;
                        await processKey(recordKey, record?.eventName);
                    }
                    return;
                }

                console.warn('Webhook received unknown payload format', JSON.stringify(body));

            } catch (err) {
                console.error('Error processing webhook:', err);
            }
        })();
    });
};
