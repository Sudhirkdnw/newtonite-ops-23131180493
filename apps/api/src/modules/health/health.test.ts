import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../shared/database/prisma';

describe('Health and Readiness Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('returns 200 with standard health check metadata', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'ok',
          environment: expect.any(String),
          version: expect.any(String),
        },
      });
      expect(typeof response.body.data.uptimeSeconds).toBe('number');
    });

    it('is also accessible under API version prefix /api/v1/health', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
    });
  });

  describe('GET /ready', () => {
    it('returns 200 when database connectivity check succeeds', async () => {
      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'ready',
          database: 'connected',
        },
      });
      expect(typeof response.body.data.latencyMs).toBe('number');
    });

    it('returns 503 Service Unavailable when database query fails', async () => {
      vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(
        new Error('Connection terminated unexpectedly')
      );

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          statusCode: 503,
          message: 'Database connection is unavailable',
        },
      });
    });
  });

  describe('404 Route Handling', () => {
    it('returns standardized 404 JSON envelope for undefined routes', async () => {
      const response = await request(app).get('/api/v1/non-existent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          statusCode: 404,
          message: expect.stringContaining('not found'),
        },
      });
    });
  });
});
