// =============================================================================
// HexWar — Performance Monitor
//
// Lightweight instrumentation for dev console. Accumulates timing samples
// per named metric and logs a grouped summary every REPORT_INTERVAL_MS.
//
// Usage:
//   import { perf } from './perf-monitor';
//   const end = perf.start('renderTerrain');
//   ... work ...
//   end();
//
// Toggle in dev console:  window.__hexPerf.toggle()
// Force report:           window.__hexPerf.report()
// =============================================================================

const REPORT_INTERVAL_MS = 3000;

interface MetricBucket {
  samples: number;
  total: number;
  min: number;
  max: number;
  last: number;
}

interface ActionRecord {
  action: string;
  time: number;
  duration: number;
}

const metrics = new Map<string, MetricBucket>();
const actions: ActionRecord[] = [];
let enabled = true;
let lastReport = performance.now();

// Frame counter
let frameCount = 0;
let frameTotalMs = 0;
let lastFrameStart = 0;
let lastFrameEnd = 0;

function getBucket(name: string): MetricBucket {
  let b = metrics.get(name);
  if (!b) {
    b = { samples: 0, total: 0, min: Infinity, max: 0, last: 0 };
    metrics.set(name, b);
  }
  return b;
}

function record(name: string, ms: number): void {
  const b = getBucket(name);
  b.samples++;
  b.total += ms;
  b.last = ms;
  if (ms < b.min) b.min = ms;
  if (ms > b.max) b.max = ms;
}

function start(name: string): () => void {
  if (!enabled) return noop;
  const t0 = performance.now();
  return () => record(name, performance.now() - t0);
}

function noop(): void {}

function logAction(action: string, durationMs: number): void {
  if (!enabled) return;
  actions.push({ action, time: performance.now(), duration: durationMs });
  if (actions.length > 50) actions.shift();
}

function markFrameStart(): void {
  if (!enabled) return;
  const now = performance.now();
  if (lastFrameEnd > 0) {
    record('gap', now - lastFrameEnd);
  }
  lastFrameStart = now;
}

function markFrameEnd(): void {
  if (!enabled) return;
  if (lastFrameStart > 0) {
    const dt = performance.now() - lastFrameStart;
    frameCount++;
    frameTotalMs += dt;
    record('frame', dt);
  }
  lastFrameEnd = performance.now();
  maybeReport();
}

function maybeReport(): void {
  const now = performance.now();
  if (now - lastReport < REPORT_INTERVAL_MS) return;
  report();
}

function report(): void {
  const now = performance.now();
  const elapsed = (now - lastReport) / 1000;
  lastReport = now;

  if (metrics.size === 0 && actions.length === 0) return;

  const fps = frameCount > 0 ? (frameCount / elapsed).toFixed(1) : '?';
  const avgFrame = frameCount > 0 ? (frameTotalMs / frameCount).toFixed(2) : '?';

  console.group(`%c[PERF] ${fps} FPS, avg frame ${avgFrame}ms (${elapsed.toFixed(1)}s window)`, 'color: #6cf; font-weight: bold');

  // Render pipeline breakdown
  const renderKeys = [...metrics.keys()].filter(k => k.startsWith('render') || k === 'frame' || k === 'gap' || k === 'syncUnitModels' || k === 'visibility' || k === 'webgl' || k === 'labelRender');
  if (renderKeys.length > 0) {
    console.group('%cRender Pipeline', 'color: #fa0');
    for (const key of renderKeys) {
      const b = metrics.get(key)!;
      const avg = b.samples > 0 ? (b.total / b.samples).toFixed(3) : '0';
      console.log(
        `%c${key.padEnd(25)}%c avg ${avg}ms  min ${b.min.toFixed(3)}ms  max ${b.max.toFixed(3)}ms  last ${b.last.toFixed(3)}ms  (${b.samples} calls)`,
        'color: #ccc', 'color: #999',
      );
    }
    console.groupEnd();
  }

  // GPU info
  if (gpuInfo) {
    console.log(
      `%cGPU: %c${gpuInfo.calls} draw calls, ${gpuInfo.triangles} triangles, ${gpuInfo.geometries} geometries, ${gpuInfo.textures} textures`,
      'color: #f6f', 'color: #c9c',
    );
  }

  // Store / state updates
  const storeKeys = [...metrics.keys()].filter(k => k.startsWith('store.') || k.startsWith('effect.'));
  if (storeKeys.length > 0) {
    console.group('%cState & Effects', 'color: #0af');
    for (const key of storeKeys) {
      const b = metrics.get(key)!;
      const avg = b.samples > 0 ? (b.total / b.samples).toFixed(3) : '0';
      console.log(
        `%c${key.padEnd(25)}%c avg ${avg}ms  last ${b.last.toFixed(3)}ms  (${b.samples} calls)`,
        'color: #ccc', 'color: #999',
      );
    }
    console.groupEnd();
  }

  // Player actions
  const recentActions = actions.filter(a => now - a.time < REPORT_INTERVAL_MS * 2);
  if (recentActions.length > 0) {
    console.group('%cPlayer Actions', 'color: #0f0');
    for (const a of recentActions) {
      const ago = ((now - a.time) / 1000).toFixed(1);
      console.log(
        `%c${a.action.padEnd(25)}%c ${a.duration.toFixed(2)}ms  (${ago}s ago)`,
        'color: #ccc', 'color: #999',
      );
    }
    console.groupEnd();
  }

  // Misc
  const miscKeys = [...metrics.keys()].filter(k => !renderKeys.includes(k) && !storeKeys.includes(k));
  if (miscKeys.length > 0) {
    console.group('%cOther', 'color: #888');
    for (const key of miscKeys) {
      const b = metrics.get(key)!;
      const avg = b.samples > 0 ? (b.total / b.samples).toFixed(3) : '0';
      console.log(
        `%c${key.padEnd(25)}%c avg ${avg}ms  (${b.samples} calls)`,
        'color: #ccc', 'color: #999',
      );
    }
    console.groupEnd();
  }

  console.groupEnd();

  // Reset accumulators
  metrics.clear();
  frameCount = 0;
  frameTotalMs = 0;
}

function toggle(): void {
  enabled = !enabled;
  console.log(`[PERF] ${enabled ? 'ENABLED' : 'DISABLED'}`);
  if (!enabled) {
    metrics.clear();
    actions.length = 0;
    frameCount = 0;
    frameTotalMs = 0;
    lastFrameEnd = 0;
  }
}

// GPU info snapshot (set externally after each render)
let gpuInfo: { calls: number; triangles: number; geometries: number; textures: number } | null = null;

function setGpuInfo(info: { calls: number; triangles: number; geometries: number; textures: number }): void {
  gpuInfo = info;
}

export const perf = {
  start,
  record,
  logAction,
  markFrameStart,
  markFrameEnd,
  report,
  toggle,
  setGpuInfo,
};

// Expose to dev console
(globalThis as Record<string, unknown>).__hexPerf = perf;
