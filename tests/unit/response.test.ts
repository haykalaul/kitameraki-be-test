import { describe, it, expect } from 'vitest';
import { ok, created, notFound, badRequest, serviceUnavailable, noContent } from '../../src/middleware/response';

describe('Response Middleware & Security Headers', () => {
  it('ok returns 200 with standard security headers', async () => {
    const res = ok({ status: 'healthy' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ status: 'healthy' });
  });

  it('created returns 201', async () => {
    const res = created({ id: '123' });
    expect(res.status).toBe(201);
  });

  it('noContent returns 204', () => {
    const res = noContent();
    expect(res.status).toBe(204);
  });

  it('notFound returns 404 with error payload', async () => {
    const res = notFound('Task not found');
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
  });

  it('badRequest returns 400 with error payload', async () => {
    const res = badRequest('Invalid payload');
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Invalid payload' },
    });
  });

  it('serviceUnavailable returns 503 with unhealthy status', async () => {
    const res = serviceUnavailable('DB unreachable');
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({
      status: 'unhealthy',
      error: 'DB unreachable',
    });
  });
});
