import { HttpResponse } from '@azure/functions';
import { ZodError } from 'zod';
import type { ApiErrorPayload } from '../types';

/** HTTP status codes used in this application */
export const HTTP = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/** Common security headers */
const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-XSS-Protection': '1; mode=block',
};

function jsonBody(statusCode: number, body: unknown, additionalHeaders: Record<string, string> = {}): HttpResponse {
  return new HttpResponse({
    status: statusCode,
    headers: {
      ...SECURITY_HEADERS,
      ...additionalHeaders,
    },
    body: JSON.stringify(body),
  });
}

export function ok<T>(data: T, headers?: Record<string, string>): HttpResponse {
  return jsonBody(HTTP.OK, data, headers);
}

export function created<T>(data: T, headers?: Record<string, string>): HttpResponse {
  return jsonBody(HTTP.CREATED, data, headers);
}

export function noContent(): HttpResponse {
  return new HttpResponse({
    status: HTTP.NO_CONTENT,
    headers: SECURITY_HEADERS,
  });
}

export function notFound(message = 'Resource not found'): HttpResponse {
  const payload: ApiErrorPayload = {
    error: { code: 'NOT_FOUND', message },
  };
  return jsonBody(HTTP.NOT_FOUND, payload);
}

export function badRequest(message: string, details?: unknown[]): HttpResponse {
  const payload: ApiErrorPayload = {
    error: { code: 'BAD_REQUEST', message, details },
  };
  return jsonBody(HTTP.BAD_REQUEST, payload);
}

export function validationError(err: ZodError): HttpResponse {
  const payload: ApiErrorPayload = {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.errors,
    },
  };
  return jsonBody(HTTP.BAD_REQUEST, payload);
}

export function serviceUnavailable(message = 'Service Unavailable', details?: unknown): HttpResponse {
  const payload = {
    status: 'unhealthy',
    timestamp: new Date().toISOString(),
    error: message,
    details,
  };
  return jsonBody(HTTP.SERVICE_UNAVAILABLE, payload);
}

export function internalError(err: unknown): HttpResponse {
  // Structured internal logging without exposing details to client
  const timestamp = new Date().toISOString();
  console.error(JSON.stringify({
    level: 'ERROR',
    timestamp,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }));

  const payload: ApiErrorPayload = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  };
  return jsonBody(HTTP.INTERNAL_ERROR, payload);
}

/** Parses raw request body safely */
export async function parseBody(request: { text(): Promise<string> }): Promise<unknown> {
  const text = await request.text();
  if (!text || text.trim() === '') return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
