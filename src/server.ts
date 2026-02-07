import { buildApp } from './app';
import { env } from './config/env';
import { startScheduler } from './jobs/syncR2';

const start = async () => {
    const app = buildApp();

    // Start background jobs
    startScheduler();

    try {
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
        console.log(`Server listening on port ${env.PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
