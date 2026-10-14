import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ZodError } from 'zod';
import { getContainer } from '../db/cosmosClient';
import { FormSettingsRepository } from '../repositories/formSettingsRepository';
import { FormSettingsService } from '../services/formSettingsService';
import { updateFormSettingsSchema } from '../schemas';
import {
  ok,
  validationError,
  internalError,
  parseBody,
} from '../middleware/response';

async function getService(): Promise<FormSettingsService> {
  const container = await getContainer();
  const repo = new FormSettingsRepository(container);
  return new FormSettingsService(repo);
}

// ---------------------------------------------------------------------------
// GET /api/form-settings
// ---------------------------------------------------------------------------
async function getFormSettings(_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  ctx.log('getFormSettings called');
  try {
    const service = await getService();
    const settings = await service.getSettings();
    const headers: Record<string, string> = {};
    if (settings._etag) {
      headers['ETag'] = settings._etag;
    }
    return ok(settings, headers);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/form-settings
// ---------------------------------------------------------------------------
async function updateFormSettings(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  ctx.log('updateFormSettings called');
  try {
    const body = await parseBody(req);
    const parseResult = updateFormSettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error as ZodError);
    }

    const ifMatchEtag = req.headers.get('if-match') || undefined;
    const service = await getService();
    const saved = await service.saveSettings(parseResult.data, ifMatchEtag);
    const headers: Record<string, string> = {};
    if (saved._etag) {
      headers['ETag'] = saved._etag;
    }
    return ok(saved, headers);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/form-settings/reset
// ---------------------------------------------------------------------------
async function resetFormSettings(_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  ctx.log('resetFormSettings called');
  try {
    const service = await getService();
    const reset = await service.resetSettings();
    const headers: Record<string, string> = {};
    if (reset._etag) {
      headers['ETag'] = reset._etag;
    }
    return ok(reset, headers);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// Register routes with Azure Functions v4 model
// ---------------------------------------------------------------------------
app.http('getFormSettings', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'form-settings',
  handler: getFormSettings,
});

app.http('updateFormSettings', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'form-settings',
  handler: updateFormSettings,
});

app.http('resetFormSettings', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'form-settings/reset',
  handler: resetFormSettings,
});
