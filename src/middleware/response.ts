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
} as const;

function jsonBody(statusCode: number, body: unknown): HttpResponse {
  return new HttpResponse({
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function ok<T>(data: T): HttpResponse {
  return jsonBody(HTTP.OK, data);
}

export function created<T>(data: T): HttpResponse {
  return jsonBody(HTTP.CREATED, data);
}

export function noContent(): HttpResponse {
  return new HttpResponse({ status: HTTP.NO_CONTENT });
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

export function internalError(err: unknown): HttpResponse {
  // Log full error server-side; return minimal info to client
  console.error('[InternalError]', err);
  const payload: ApiErrorPayload = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  };
  return jsonBody(HTTP.INTERNAL_ERROR, payload);
}

/** Parses raw request body (string or Buffer) into a plain object */
export async function parseBody(request: { text(): Promise<string> }): Promise<unknown> {
  const text = await request.text();
  if (!text || text.trim() === '') return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
