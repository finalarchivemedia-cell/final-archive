import cron from 'node-cron';
import { R2Service } from '../services/r2';
import { prisma } from '../utils/prisma';
import { IdGenerator } from '../services/idGenerator';
import { env } from '../config/env';

export const runSync = async () => {
    if (!env.ENABLE_R2_SYNC) {
        console.log('Skipping R2 Sync (DISABLED)');
        return;
    }

    console.log('Starting R2 Sync...');
    const r2 = new R2Service();

    try {
        const objects = await r2.listAllObjects(env.R2_PREFIX);

        const existingImages = await prisma.image.findMany({
            select: { originalKey: true }
        });
        const existingKeys = new Set(existingImages.map(i => i.originalKey));

        let newCount = 0;

        for (const obj of objects) {
            if (!obj.Key) continue;

            if (env.R2_PREFIX && !obj.Key.startsWith(env.R2_PREFIX)) continue;

            const mediaType = R2Service.getMediaType(obj.Key);
            if (!mediaType) continue;

            if (!existingKeys.has(obj.Key)) {
                // We trust env.CDN_BASE_URL is present because of refine logic + ENABLE_R2_SYNC check
                const url = `${env.CDN_BASE_URL}/${obj.Key}`;
                await IdGenerator.createImageRecord({
                    originalKey: obj.Key,
                    url: url,
                    mediaType,
                    sizeBytes: obj.Size,
                });
                newCount++;
            }
        }

        console.log(`Sync complete. Registered ${newCount} new images.`);

    } catch (err) {
        console.error('Error during R2 Sync:', err);
    }
};

export const startScheduler = () => {
    if (!env.ENABLE_R2_SYNC) {
        return;
    }
    // Run every minute
    cron.schedule('* * * * *', () => {
        runSync();
    });
};
