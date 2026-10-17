import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config(); // fallback to current dir

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_TEST_URL: z.string().optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long for security'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  DEMO_PASSWORD_SALT_ROUNDS: z.coerce.number().int().min(4).max(14).default(10),

  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(rawEnv: Record<string, unknown> = process.env): EnvConfig {
  const result = EnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(
      `[Configuration Error] Invalid environment variables:\n${formattedErrors}\nPlease check your .env configuration.`
    );
  }
  return result.data;
}

export const env: EnvConfig = validateEnv();
