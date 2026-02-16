import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { env } from '../config/env';
import bcrypt from 'bcryptjs';

import { runSync } from '../jobs/syncR2';

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

        return {
            displayDurationSec: (durationSetting?.value as number) || 6,
            cropPercent: (cropSetting?.value as number) || 60
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

};
