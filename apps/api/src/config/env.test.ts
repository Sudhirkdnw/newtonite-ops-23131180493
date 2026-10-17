import { describe, it, expect } from 'vitest';
import { validateEnv } from './env';

describe('Environment Configuration Validation', () => {
  const validBaseEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    HOST: '127.0.0.1',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/newtonite_test?schema=public',
    JWT_SECRET: 'a-super-secret-key-that-is-at-least-32-chars-long!',
    CORS_ORIGIN: 'http://localhost:5173',
  };

  it('validates a correct environment configuration and applies defaults', () => {
    const config = validateEnv(validBaseEnv);
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(4000);
    expect(config.API_PREFIX).toBe('/api/v1');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.JWT_EXPIRES_IN).toBe('8h');
  });

  it('throws a descriptive error when required DATABASE_URL is missing', () => {
    const invalidEnv = { ...validBaseEnv, DATABASE_URL: '' };
    expect(() => validateEnv(invalidEnv)).toThrowError(/DATABASE_URL is required/);
  });

  it('throws an error when JWT_SECRET is shorter than 32 characters', () => {
    const invalidEnv = { ...validBaseEnv, JWT_SECRET: 'short-secret' };
    expect(() => validateEnv(invalidEnv)).toThrowError(/JWT_SECRET must be at least 32 characters/);
  });

  it('coerces numeric string PORT to number', () => {
    const customEnv = { ...validBaseEnv, PORT: '8080' };
    const config = validateEnv(customEnv);
    expect(config.PORT).toBe(8080);
    expect(typeof config.PORT).toBe('number');
  });
});
