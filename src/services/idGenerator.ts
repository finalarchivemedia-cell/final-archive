import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';

export class IdGenerator {
    private static generateId(): string {
        // Generate a random integer between 0 and 99999
        const num = Math.floor(Math.random() * 100000);
        // Pad with leading zeros to ensure 5 digits
        return num.toString().padStart(5, '0');
    }

    static async createImageRecord(data: {
        originalKey: string;
        url: string;
        mediaType?: 'IMAGE' | 'VIDEO';
        width?: number;
        height?: number;
        sizeBytes?: number;
        contentType?: string;
    }) {
        const maxRetries = 10;
        let attempts = 0;

        while (attempts < maxRetries) {
            const id = this.generateId();
            try {
                return await prisma.image.create({
                    data: {
                        id,
                        ...data,
                        mediaType: (data.mediaType as any) ?? 'IMAGE',
                    },
                });
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    if (error.code === 'P2002') {
                        const target = error.meta?.target as string[];
                        // If collision is on 'id', retry.
                        if (target && target.includes('id')) {
                            attempts++;
                            continue;
                        }
                        // If collision is on 'originalKey', re-throw (it's a duplicate image)
                        if (target && target.includes('originalKey')) {
                            throw error;
                        }
                    }
                }
                throw error;
            }
        }
        throw new Error(`Failed to generate unique ID after ${maxRetries} attempts`);
    }
}
