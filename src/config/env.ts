import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const baseSchema = z.object({
    DATABASE_URL: z.string(),
    // Optional: direct/unpooled DB URL (used by Prisma via directUrl)
    DATABASE_URL_UNPOOLED: z.string().optional(),
    PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
    ADMIN_PASSWORD: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    WEBHOOK_SECRET: z.string().min(1),
    // Comma-separated list of allowed origins for CORS (frontend domains)
    CORS_ORIGINS: z.string().optional().transform((s) => {
        if (!s) return undefined;
        const parts = s.split(',').map(v => v.trim()).filter(Boolean);
        return parts.length ? parts : undefined;
    }),
    // Default to false if not provided or anything other than 'true'
    ENABLE_R2_SYNC: z.string().default('false').transform(s => s === 'true'),
    VITE_API_BASE_URL: z.string().url().optional(), // For frontend mostly, but good to know

    // Contact / Email (Resend recommended)
    RESEND_API_KEY: z.string().optional(),
    CONTACT_TO: z.string().email().optional(),
    CONTACT_FROM: z.string().optional(),
});

const r2Schema = z.object({
    R2_ENDPOINT: z.string().url(),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    R2_PREFIX: z.string().optional().default(''),
    CDN_BASE_URL: z.string().url(),
});

// Combine and refine
const envSchema = baseSchema.and(r2Schema.partial()).superRefine((data, ctx) => {
    if (data.ENABLE_R2_SYNC) {
        const result = r2Schema.safeParse(data);
        if (!result.success) {
            result.error.issues.forEach((issue) => {
                ctx.addIssue(issue);
            });
        }
    }
});

export const env = envSchema.parse(process.env) as z.infer<typeof baseSchema> & Partial<z.infer<typeof r2Schema>>;

if (!env.ENABLE_R2_SYNC) {
    console.warn('⚠️  R2 Sync is DISABLED. Images will not be synced and webhook is inactive.');
}
