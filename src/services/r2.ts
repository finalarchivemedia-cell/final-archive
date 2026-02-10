import { S3Client, ListObjectsV2Command, _Object } from '@aws-sdk/client-s3';
import { env } from '../config/env';

export class R2Service {
    private client: S3Client | undefined;

    constructor() {
        if (env.ENABLE_R2_SYNC && env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
            this.client = new S3Client({
                region: 'auto',
                endpoint: env.R2_ENDPOINT,
                credentials: {
                    accessKeyId: env.R2_ACCESS_KEY_ID,
                    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
                },
            });
        } else {
            // Can optionally log debug warning here, but we check env.ENABLE_R2_SYNC before using usually
        }
    }

    async listAllObjects(prefix = ''): Promise<_Object[]> {
        if (!this.client) {
            throw new Error("R2 Client is not initialized (ENABLE_R2_SYNC is false)");
        }

        let continuationToken: string | undefined = undefined;
        const allObjects: _Object[] = [];

        do {
            const command = new ListObjectsV2Command({
                Bucket: env.R2_BUCKET,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            });

            const response = await this.client.send(command) as any;

            if (response.Contents) {
                allObjects.push(...response.Contents);
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        return allObjects;
    }

    static getMediaType(key: string): 'IMAGE' | 'VIDEO' | null {
        const lowerKey = key.toLowerCase();
        const imageExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
        const videoExt = ['.mp4', '.webm', '.mov'];
        if (imageExt.some(ext => lowerKey.endsWith(ext))) return 'IMAGE';
        if (videoExt.some(ext => lowerKey.endsWith(ext))) return 'VIDEO';
        return null;
    }

    static isImage(key: string): boolean {
        return this.getMediaType(key) === 'IMAGE';
    }

    static isSupportedMedia(key: string): boolean {
        return this.getMediaType(key) !== null;
    }
}
