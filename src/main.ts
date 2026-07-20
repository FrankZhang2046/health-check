import { SERVICES, type Service } from './services.ts';
import { fetchHealth, type HealthResult } from './health.ts';
import type { CheckStatus } from './types.ts';

const POLL_INTERVAL_MS = 30_000;
const TICK_INTERVAL_MS = 1_000;
const THEME_STORAGE_KEY = 'health-check-theme';

type ServiceState = { service: Service; result: HealthResult | null };

const state = {
  services: new Map<string, ServiceState>(
    SERVICES.map((s) => [s.id, { service: s, result: null }])
  ),
  now: Date.now(),
};

let pollTimer: number | null = null;
let tickTimer: number | null = null;

// ── Theme ────────────────────────────────────────────────────────────────────

function currentTheme(): 'dark' | 'light' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
}

// ── Formatting ───────────────────────────────────────────────────────────────

function statusLabel(s: CheckStatus): string {
  return { healthy: 'Healthy', degraded: 'Degraded', unhealthy: 'Unhealthy' }[s];
}

function formatAgo(fetchedAt: Date): string {
  const secs = Math.max(0, Math.floor((state.now - fetchedAt.getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s ago`;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderCard(entry: ServiceState): HTMLElement {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.serviceId = entry.service.id;

  const header = document.createElement('div');
  header.className = 'card-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';
  const name = document.createElement('span');
  name.className = 'card-name';
  name.textContent = entry.service.name;
  titleRow.appendChild(name);

  const version = document.createElement('span');
  version.className = 'card-version';
  if (entry.result?.ok) version.textContent = `v${entry.result.data.version}`;
  titleRow.appendChild(version);

  header.appendChild(titleRow);

  const pill = document.createElement('span');
  pill.className = 'pill';
  if (!entry.result) {
    pill.textContent = 'Loading';
  } else if (entry.result.ok) {
    pill.classList.add(entry.result.data.status);
    pill.textContent = statusLabel(entry.result.data.status);
  } else {
    pill.textContent = 'Error';
  }
  header.appendChild(pill);
  card.appendChild(header);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  if (!entry.result) {
    meta.textContent = 'Awaiting response…';
  } else if (entry.result.ok) {
    meta.textContent = `Last updated ${formatAgo(entry.result.fetchedAt)}`;
  } else {
    meta.textContent = `Failed ${formatAgo(entry.result.fetchedAt)}`;
  }
  card.appendChild(meta);

  if (!entry.result) {
    card.appendChild(renderSkeleton());
  } else if (!entry.result.ok) {
    card.appendChild(renderError(entry.result.error));
  } else {
    card.appendChild(renderChecks(entry.result.data.checks));
  }

  return card;
}

function renderSkeleton(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  for (const w of ['w1', 'w2', 'w3'] as const) {
    const line = document.createElement('div');
    line.className = `skeleton-line ${w}`;
    wrap.appendChild(line);
  }
  return wrap;
}

function renderError(message: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'error-state';
  const title = document.createElement('div');
  title.className = 'error-state-title';
  title.textContent = 'Unable to reach /healthCheck';
  const detail = document.createElement('div');
  detail.className = 'error-state-detail';
  detail.textContent = message;
  wrap.appendChild(title);
  wrap.appendChild(detail);
  return wrap;
}

function renderChecks(checks: { name: string; status: CheckStatus; latencyMs: number; critical: boolean; error?: string }[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checks';
  for (const c of checks) {
    const row = document.createElement('div');
    row.className = 'check';

    const main = document.createElement('div');
    main.className = 'check-main';

    const nameGroup = document.createElement('div');
    nameGroup.className = 'check-name-group';
    const cname = document.createElement('span');
    cname.className = 'check-name';
    cname.textContent = c.name;
    nameGroup.appendChild(cname);
    if (c.critical) {
      const tag = document.createElement('span');
      tag.className = 'critical-tag';
      tag.textContent = 'critical';
      nameGroup.appendChild(tag);
    }
    main.appendChild(nameGroup);

    const right = document.createElement('div');
    right.className = 'check-right';
    const lat = document.createElement('span');
    lat.className = 'latency';
    lat.textContent = `${c.latencyMs}ms`;
    right.appendChild(lat);
    const pill = document.createElement('span');
    pill.className = `pill ${c.status}`;
    pill.textContent = statusLabel(c.status);
    right.appendChild(pill);
    main.appendChild(right);

    row.appendChild(main);

    if (c.error) {
      const err = document.createElement('div');
      err.className = 'error-line';
      err.textContent = c.error;
      row.appendChild(err);
    }
    wrap.appendChild(row);
  }
  return wrap;
}

function renderRollup() {
  const dot = document.getElementById('rollup-dot');
  const text = document.getElementById('rollup-text');
  const chip = document.getElementById('stats-chip');
  if (!dot || !text || !chip) return;

  const results = [...state.services.values()].map((s) => s.result);
  const total = results.length;
  const loaded = results.filter((r): r is HealthResult => r !== null);
  const healthy = loaded.filter((r) => r.ok && r.data.status === 'healthy').length;
  const degraded = loaded.filter((r) => r.ok && r.data.status === 'degraded').length;
  const down = loaded.filter((r) => !r.ok || (r.ok && r.data.status === 'unhealthy')).length;

  dot.className = 'dot';
  if (loaded.length === 0) {
    text.textContent = 'Loading…';
  } else if (down > 0) {
    dot.classList.add('unhealthy');
    text.textContent = `${down} service${down > 1 ? 's' : ''} down`;
  } else if (degraded > 0) {
    dot.classList.add('degraded');
    text.textContent = `${degraded} service${degraded > 1 ? 's' : ''} degraded`;
  } else {
    dot.classList.add('healthy');
    text.textContent = 'All systems operational';
  }

  chip.textContent = `${healthy}/${total} healthy`;
}

function render() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.replaceChildren(...[...state.services.values()].map(renderCard));
  renderRollup();
}

// ── Polling ──────────────────────────────────────────────────────────────────

async function pollAll() {
  const entries = [...state.services.values()];
  const results = await Promise.allSettled(entries.map((e) => fetchHealth(e.service)));
  results.forEach((r, i) => {
    const entry = entries[i]!;
    if (r.status === 'fulfilled') {
      entry.result = r.value;
    } else {
      entry.result = { ok: false, error: String(r.reason), fetchedAt: new Date() };
    }
  });
  state.now = Date.now();
  render();
}

function startPolling() {
  if (pollTimer !== null) return;
  pollTimer = window.setInterval(pollAll, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function tick() {
  state.now = Date.now();
  // Only update the meta lines to avoid full re-render every second.
  for (const entry of state.services.values()) {
    const card = document.querySelector<HTMLElement>(`.card[data-service-id="${entry.service.id}"] .card-meta`);
    if (!card || !entry.result) continue;
    card.textContent = entry.result.ok
      ? `Last updated ${formatAgo(entry.result.fetchedAt)}`
      : `Failed ${formatAgo(entry.result.fetchedAt)}`;
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
  initTheme();
  render();

  document.getElementById('refresh-btn')?.addEventListener('click', () => pollAll());
  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
      pollAll();
    }
  });

  pollAll();
  startPolling();
  tickTimer = window.setInterval(tick, TICK_INTERVAL_MS);
}

init();

// Vite HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopPolling();
    if (tickTimer !== null) clearInterval(tickTimer);
  });
}
