import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../utils/prisma';

export const publicRoutes: FastifyPluginAsyncZod = async (app) => {

    // GET /api/images
    app.get('/images', {
        schema: {
            response: {
                200: z.array(z.object({
                    id: z.string(),
                    url: z.string(),
                    mediaType: z.enum(['IMAGE', 'VIDEO']),
                    createdAt: z.string().datetime(),
                })),
            },
        },
    }, async (req, reply) => {
        reply.header('Cache-Control', 'public, s-maxage=10, stale-while-revalidate');

        const images = await prisma.image.findMany({
            where: { isActive: true },
            select: {
                id: true,
                url: true,
                mediaType: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return images.map((img) => ({
            ...img,
            createdAt: img.createdAt.toISOString(),
        }));
    });

    // GET /api/images/random
    app.get('/images/random', {
        schema: {
            response: {
                200: z.object({
                    id: z.string(),
                    url: z.string(),
                    mediaType: z.enum(['IMAGE', 'VIDEO']),
                    createdAt: z.string().datetime(),
                }),
            },
        },
    }, async (req, reply) => {
        // Improvement: added cache control as requested
        reply.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

        // Efficient random sampling using PostgreSQL random() if table is small-ish
        // For prisma, we can use raw query or skip
        const count = await prisma.image.count({ where: { isActive: true } });
        if (count === 0) {
            return reply.code(404).send();
        }
        const skip = Math.floor(Math.random() * count);
        const [image] = await prisma.image.findMany({
            where: { isActive: true },
            take: 1,
            skip: skip,
            select: {
                id: true,
                url: true,
                mediaType: true,
                createdAt: true
            }
        });

        if (!image) return reply.code(404).send();
        return {
            ...image,
            createdAt: image.createdAt.toISOString(),
        };
    });

    // GET /api/images/:id
    app.get('/images/:id', {
        schema: {
            params: z.object({
                id: z.string().length(5),
            }),
            response: {
                200: z.object({
                    id: z.string(),
                    url: z.string(),
                    mediaType: z.enum(['IMAGE', 'VIDEO']),
                    createdAt: z.string().datetime()
                })
            }
        },
    }, async (req, reply) => {
        const { id } = req.params;

        // We check for the record regardless of active state first to distinguish 404 vs 410
        const image = await prisma.image.findUnique({
            where: { id },
            select: {
                id: true,
                url: true,
                mediaType: true,
                createdAt: true,
                isActive: true,
            }
        });

        if (!image) {
            return reply.code(404).send();
        }

        if (!image.isActive) {
            return reply.code(410).send(); // Gone
        }

        reply.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate');

        return {
            id: image.id,
            url: image.url,
            mediaType: image.mediaType as any,
            createdAt: image.createdAt.toISOString()
        };
    });

    // GET /api/settings
    app.get('/settings', {
        schema: {
            response: {
                200: z.object({
                    displayDurationSec: z.number(),
                    cropPercent: z.number(),
                    musicUrl: z.string().url().nullable().optional()
                })
            }
        }
    }, async (req, reply) => {
        reply.header('Cache-Control', 'public, s-maxage=60');

        // Fetch settings or use defaults
        const durationSetting = await prisma.settings.findUnique({ where: { key: 'displayDurationSec' } });
        const cropSetting = await prisma.settings.findUnique({ where: { key: 'cropPercent' } });
        const musicSetting = await prisma.settings.findUnique({ where: { key: 'musicUrl' } });

        return {
            displayDurationSec: (durationSetting?.value as number) || 6,
            cropPercent: (cropSetting?.value as number) || 60,
            musicUrl: (musicSetting?.value as string) || null
        };
    });
};
