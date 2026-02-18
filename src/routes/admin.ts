import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { env } from '../config/env';
import bcrypt from 'bcryptjs';

import { runSync } from '../jobs/syncR2';
import { R2Service } from '../services/r2';
import { IdGenerator } from '../services/idGenerator';

// Manual sync function logic (reused for job)
export const syncR2Logic = async () => {
    return await runSync();
};

export const adminRoutes: FastifyPluginAsyncZod = async (app) => {

    // POST /api/admin/login
    app.post('/login', {
        schema: {
            body: z.object({
                password: z.string(),
            }),
            response: {
                200: z.object({
                    token: z.string(),
                }),
            },
        },
    }, async (req, reply) => {
        const { password } = req.body;
        const isBcryptHash = env.ADMIN_PASSWORD.startsWith('$2a$')
            || env.ADMIN_PASSWORD.startsWith('$2b$')
            || env.ADMIN_PASSWORD.startsWith('$2y$');
        const isValid = isBcryptHash
            ? await bcrypt.compare(password, env.ADMIN_PASSWORD)
            : password === env.ADMIN_PASSWORD;

        if (!isValid) {
            return reply.code(401).send({ message: 'Invalid credentials' } as any);
        }

        const token = app.jwt.sign({ role: 'admin' });
        return { token };
    });

    // Protected Routes Hook
    app.addHook('onRequest', async (req, reply) => {
        if (req.method === 'OPTIONS') return;
        const isLoginRoute = req.routerPath === '/login'
            || req.raw.url?.startsWith('/api/admin/login') === true;
        if (isLoginRoute) return;
        try {
            await req.jwtVerify();
            const role = (req.user as any)?.role;
            if (role !== 'admin') {
                return reply.code(403).send({ message: 'Forbidden' } as any);
            }
        } catch (err) {
            reply.send(err);
        }
    });

    // GET /api/admin/settings
    app.get('/settings', async (req, reply) => {
        const durationSetting = await prisma.settings.findUnique({ where: { key: 'displayDurationSec' } });
        const cropSetting = await prisma.settings.findUnique({ where: { key: 'cropPercent' } });
        const musicSetting = await prisma.settings.findUnique({ where: { key: 'musicUrl' } });

        return {
            displayDurationSec: (durationSetting?.value as number) || 6,
            cropPercent: (cropSetting?.value as number) || 60,
            musicUrl: (musicSetting?.value as string) || null
        };
    });

    // GET /api/admin/images
    app.get('/images', async (req, reply) => {
        const images = await prisma.image.findMany({
            select: {
                id: true,
                url: true,
                mediaType: true,
                createdAt: true,
                isActive: true,
                originalKey: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return images.map((img) => ({
            ...img,
            createdAt: img.createdAt.toISOString(),
        }));
    });

    // PUT /api/admin/settings
    app.put('/settings', {
        schema: {
            body: z.object({
                displayDurationSec: z.number().min(1).max(10),
                cropPercent: z.number().min(25).max(100)
            })
        }
    }, async (req, reply) => {
        const { displayDurationSec, cropPercent } = req.body;

        await prisma.settings.upsert({
            where: { key: 'displayDurationSec' },
            update: { value: displayDurationSec },
            create: { key: 'displayDurationSec', value: displayDurationSec }
        });

        await prisma.settings.upsert({
            where: { key: 'cropPercent' },
            update: { value: cropPercent },
            create: { key: 'cropPercent', value: cropPercent }
        });

        return { ok: true };
    });

    // POST /api/admin/refresh
    app.post('/refresh', async (req, reply) => {
        const result = await syncR2Logic();
        if (result.skipped) {
            return reply.code(400).send(result);
        }
        return result;
    });

    // POST /api/admin/music
    app.post('/music', async (req, reply) => {
        if (!env.ENABLE_R2_SYNC) {
            return reply.code(400).send({ ok: false, message: 'R2 sync is disabled' });
        }

        const r2 = new R2Service();
        const prefix = env.R2_PREFIX ? env.R2_PREFIX.replace(/\/?$/, '/') : '';

        try {
            const parts = req.parts();
            for await (const part of parts) {
                if (part.type !== 'file') continue;
                const filename = part.filename || 'music';
                const lower = filename.toLowerCase();
                if (!['.mp3', '.m4a', '.wav', '.aac'].some(ext => lower.endsWith(ext))) {
                    return reply.code(400).send({ ok: false, message: 'Unsupported audio format' });
                }

                const chunks: Buffer[] = [];
                for await (const chunk of part.file) {
                    chunks.push(chunk as Buffer);
                }
                const buffer = Buffer.concat(chunks);

                const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const key = `${prefix}admin/music/${unique}-${safeName}`;

                await r2.putObject(key, buffer, part.mimetype);

                const url = `${env.CDN_BASE_URL}/${key}`;
                await prisma.settings.upsert({
                    where: { key: 'musicUrl' },
                    update: { value: url },
                    create: { key: 'musicUrl', value: url }
                });

                return { ok: true, musicUrl: url };
            }

            return reply.code(400).send({ ok: false, message: 'No file received' });
        } catch (err: any) {
            return reply.code(500).send({ ok: false, message: 'Music upload failed' });
        }
    });

    // POST /api/admin/upload
    app.post('/upload', async (req, reply) => {
        if (!env.ENABLE_R2_SYNC) {
            return reply.code(400).send({ ok: false, message: 'R2 sync is disabled' });
        }

        const r2 = new R2Service();
        const uploaded: string[] = [];
        const skipped: string[] = [];
        const errors: string[] = [];
        const prefix = env.R2_PREFIX ? env.R2_PREFIX.replace(/\/?$/, '/') : '';

        try {
            const parts = req.parts();
            for await (const part of parts) {
                if (part.type !== 'file') continue;
                const filename = part.filename || 'upload';
                const mediaType = R2Service.getMediaType(filename);
                if (!mediaType) {
                    skipped.push(filename);
                    continue;
                }

                const chunks: Buffer[] = [];
                for await (const chunk of part.file) {
                    chunks.push(chunk as Buffer);
                }
                const buffer = Buffer.concat(chunks);

                const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const key = `${prefix}admin/${unique}-${safeName}`;

                await r2.putObject(key, buffer, part.mimetype);

                const url = `${env.CDN_BASE_URL}/${key}`;
                await IdGenerator.createImageRecord({
                    originalKey: key,
                    url,
                    mediaType,
                    sizeBytes: buffer.length,
                    contentType: part.mimetype,
                });

                uploaded.push(filename);
            }

            return {
                ok: true,
                uploaded: uploaded.length,
                skipped: skipped.length,
                errors,
            };
        } catch (err: any) {
            return reply.code(500).send({
                ok: false,
                message: 'Upload failed',
            });
        }
    });

    // POST /api/admin/images/:id/deactivate
    app.post('/images/:id/deactivate', {
        schema: {
            params: z.object({
                id: z.string()
            })
        }
    }, async (req, reply) => {
        const { id } = req.params;

        const result = await prisma.image.updateMany({
                where: { id },
                data: { isActive: false }
            });

        if (result.count === 0) {
            return reply.code(404).send({ ok: false, message: 'Image not found' } as any);
        }

        return { ok: true };
    });

    // POST /api/admin/images/:id/activate
    app.post('/images/:id/activate', {
        schema: {
            params: z.object({
                id: z.string()
            })
        }
    }, async (req, reply) => {
        const { id } = req.params;

        const result = await prisma.image.updateMany({
            where: { id },
            data: { isActive: true }
        });

        if (result.count === 0) {
            return reply.code(404).send({ ok: false, message: 'Image not found' } as any);
        }

        return { ok: true };
    });

    // DELETE /api/admin/images/:id
    app.delete('/images/:id', {
        schema: {
            params: z.object({
                id: z.string()
            })
        }
    }, async (req, reply) => {
        if (!env.ENABLE_R2_SYNC) {
            return reply.code(400).send({ ok: false, message: 'R2 sync is disabled' });
        }

        const { id } = req.params;
        const record = await prisma.image.findUnique({
            where: { id },
            select: { originalKey: true }
        });

        if (!record) {
            return reply.code(404).send({ ok: false, message: 'Image not found' } as any);
        }

        try {
            const r2 = new R2Service();
            await r2.deleteObject(record.originalKey);
            await prisma.image.delete({ where: { id } });
            return { ok: true };
        } catch (e) {
            return reply.code(500).send({ ok: false, message: 'Delete failed' } as any);
        }
    });

};
