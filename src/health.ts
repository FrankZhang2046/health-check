import type { HealthResponse } from './types.ts';
import type { Service } from './services.ts';

export type HealthResult =
  | { ok: true; data: HealthResponse; fetchedAt: Date }
  | { ok: false; error: string; fetchedAt: Date };

const DEFAULT_TIMEOUT_MS = 8000;

export async function fetchHealth(service: Service, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<HealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(service.url, { signal: controller.signal, cache: 'no-store' });
    // The endpoint returns 503 when unhealthy — still a valid JSON payload we want to render.
    if (!res.ok && res.status !== 503) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}`, fetchedAt: new Date() };
    }
    const data = (await res.json()) as HealthResponse;
    return { ok: true, data, fetchedAt: new Date() };
  } catch (err) {
    const message = err instanceof DOMException && err.name === 'AbortError'
      ? `Timeout after ${timeoutMs / 1000}s`
      : err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, fetchedAt: new Date() };
  } finally {
    clearTimeout(timer);
  }
}
