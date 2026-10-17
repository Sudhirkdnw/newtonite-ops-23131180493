import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../apps/api/src/app';

describe('Global Integration Health Gateway', () => {
  it('ensures /health responds with 200 and success status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('ensures /ready confirms postgres connection', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database).toBe('connected');
  });
});
