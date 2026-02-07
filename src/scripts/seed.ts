import { PrismaClient } from '@prisma/client';
import { IdGenerator } from '../services/idGenerator';

const prisma = new PrismaClient();

// Placeholder images (Unsplash source)
const PLACEHOLDERS = [
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1470119693884-47d3a1d1f180?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop'
];

async function main() {
    console.log('🌱 Seeding database with placeholder images...');

    for (const url of PLACEHOLDERS) {
        const key = `seed-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Check if we already seeded some
        const exists = await prisma.image.findFirst({ where: { url } });
        if (exists) continue;

        const record = await IdGenerator.createImageRecord({
            originalKey: key,
            url: url,
            width: 1920,
            height: 1080,
            contentType: 'image/jpeg'
        });

        console.log(`✅ Created image: ${record.id} -> ${url}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
