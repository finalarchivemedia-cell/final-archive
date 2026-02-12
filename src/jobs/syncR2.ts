import cron from 'node-cron';
import { R2Service } from '../services/r2';
import { prisma } from '../utils/prisma';
import { IdGenerator } from '../services/idGenerator';
import { env } from '../config/env';

export interface SyncResult {
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    newCount: number;
    deactivatedCount: number;
    reactivatedCount: number;
}

export const runSync = async (): Promise<SyncResult> => {
    if (!env.ENABLE_R2_SYNC) {
        console.log('Skipping R2 Sync (DISABLED)');
        return {
            ok: false,
            skipped: true,
            reason: 'R2 sync disabled',
            newCount: 0,
            deactivatedCount: 0,
            reactivatedCount: 0,
        };
    }

    console.log('Starting R2 Sync...');
    const r2 = new R2Service();

    try {
        const objects = await r2.listAllObjects(env.R2_PREFIX);

        // Get all existing images from database
        const existingImages = await prisma.image.findMany({
            select: { originalKey: true, isActive: true }
        });
        const existingKeys = new Set(existingImages.map(i => i.originalKey));
        
        // Get all keys currently in R2
        const r2Keys = new Set<string>();
        for (const obj of objects) {
            if (!obj.Key) continue;
            if (env.R2_PREFIX && !obj.Key.startsWith(env.R2_PREFIX)) continue;
            const mediaType = R2Service.getMediaType(obj.Key);
            if (!mediaType) continue;
            r2Keys.add(obj.Key);
        }

        let newCount = 0;
        let deactivatedCount = 0;
        let reactivatedCount = 0;

        // Add new images from R2
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
            } else {
                // Reactivate if it was previously deactivated but now exists in R2
                const existing = existingImages.find(img => img.originalKey === obj.Key);
                if (existing && !existing.isActive) {
                    await prisma.image.updateMany({
                        where: { originalKey: obj.Key },
                        data: { isActive: true }
                    });
                    reactivatedCount++;
                }
            }
        }

        // Deactivate images that no longer exist in R2
        for (const img of existingImages) {
            if (!r2Keys.has(img.originalKey) && img.isActive) {
                await prisma.image.updateMany({
                    where: { originalKey: img.originalKey },
                    data: { isActive: false }
                });
                deactivatedCount++;
            }
        }

        console.log(`Sync complete. Registered ${newCount} new images. Deactivated ${deactivatedCount} missing images. Reactivated ${reactivatedCount} images.`);
        return {
            ok: true,
            newCount,
            deactivatedCount,
            reactivatedCount,
        };

    } catch (err) {
        console.error('Error during R2 Sync:', err);
        return {
            ok: false,
            reason: 'Error during R2 Sync',
            newCount: 0,
            deactivatedCount: 0,
            reactivatedCount: 0,
        };
    }
};

export const startScheduler = () => {
    if (!env.ENABLE_R2_SYNC) {
        return;
    }
    // Run every minute
    cron.schedule('* * * * *', () => {
        void runSync();
    });
};
