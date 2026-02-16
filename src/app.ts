import fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from './config/env';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';
import { webhookRoutes } from './routes/webhook';
import { contactRoutes } from './routes/contact';

export const buildApp = () => {
    const app = fastify({
        logger: true, // Enable logging for debugging
    }).withTypeProvider<ZodTypeProvider>();

    // Validation
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // Security
    app.register(helmet);
    app.register(cors, {
        origin: env.CORS_ORIGINS?.length
            ? env.CORS_ORIGINS
            : [
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'https://finalarchivemedia.com',
                'https://www.finalarchivemedia.com'
            ],
        credentials: true
    });
    app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    // Auth
    app.register(jwt, {
        secret: env.JWT_SECRET,
        sign: {
            expiresIn: '1h',
        },
    });

    // Routes
    app.register(publicRoutes, { prefix: '/api' });
    app.register(contactRoutes, { prefix: '/api' });
    app.register(adminRoutes, { prefix: '/api/admin' });
    app.register(webhookRoutes, { prefix: '/api/storage' });

    app.get('/api/health', async () => {
        return { ok: true };
    });

    // Root route for convenience
    app.get('/', async () => {
        return { message: "Final Archive Backend is Running", docs: "/api/health" };
    });

    return app;
};
