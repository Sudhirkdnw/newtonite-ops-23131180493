import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { env } from '../../config/env';

describe('Authentication & Identity Endpoints', () => {
  const validEmail = 'alice.admin@newtonite.dev';
  const validPassword = 'Demo@Newtonite2026!';

  describe('POST /api/v1/auth/login', () => {
    it('successfully authenticates a valid seeded user and returns signed JWT and safe profile', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: validEmail,
        password: validPassword,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();

      const user = response.body.data.user;
      expect(user.email).toBe(validEmail);
      expect(user.name).toBe('Alice Admin');
      expect(user.systemRole).toBe('SYSTEM_ADMIN');
      expect(user.passwordHash).toBeUndefined(); // Never expose password hash
      expect(Array.isArray(user.memberships)).toBe(true);
      expect(user.memberships.length).toBeGreaterThan(0);

      // Verify token signature and claims
      const decoded = jwt.verify(response.body.data.token, env.JWT_SECRET) as {
        sub: string;
        email: string;
        systemRole: string;
      };
      expect(decoded.sub).toBe(user.id);
      expect(decoded.email).toBe(validEmail);
    });

    it('rejects invalid password with HTTP 401 Unauthorized', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: validEmail,
        password: 'WrongPassword123!',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('rejects non-existent email with HTTP 401 Unauthorized', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'does-not-exist@newtonite.dev',
        password: validPassword,
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects malformed email format with HTTP 422 Validation Error', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'not-an-email',
        password: validPassword,
      });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the current user profile when given a valid Bearer token', async () => {
      // First login to get token
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'bob.lead@newtonite.dev',
        password: validPassword,
      });
      const token = loginRes.body.data.token;

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('bob.lead@newtonite.dev');
      expect(response.body.data.name).toBe('Bob Lead');
      expect(response.body.data.memberships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            teamSlug: 'core-ops',
            role: 'LEAD',
          }),
        ])
      );
    });

    it('rejects unauthenticated request with HTTP 401', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects malformed or invalid token with HTTP 401', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired token with HTTP 401', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { sub: 'user-id', email: validEmail, systemRole: 'USER' },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('expired');
    });
  });
});
