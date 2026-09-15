const target = String(process.env.TARGET_URL ?? '').replace(/\/$/, '');
const pathname = String(process.env.PATHNAME ?? '/api/health');
const requests = Math.max(1, Math.min(5000, Number(process.env.REQUESTS ?? 200)));
const concurrency = Math.max(1, Math.min(100, Number(process.env.CONCURRENCY ?? 20)));
const timeoutMs = Math.max(500, Math.min(30000, Number(process.env.TIMEOUT_MS ?? 5000)));
const maxP95Ms = Math.max(50, Number(process.env.MAX_P95_MS ?? 1000));
const maxErrorRate = Math.max(0, Math.min(1, Number(process.env.MAX_ERROR_RATE ?? 0.02)));

if (!target || !/^https?:\/\//.test(target)) {
  console.error('TARGET_URL es obligatorio, por ejemplo https://api-staging.example.com');
  process.exit(2);
}

if (process.env.ALLOW_PRODUCTION_LOAD_TEST !== 'true' && /(^|[.-])(prod|production)([.-]|$)/i.test(new URL(target).hostname)) {
  console.error('Este smoke test está bloqueado para hostnames que parecen producción. Usa staging.');
  process.exit(2);
}

const url = new URL(pathname.startsWith('/') ? pathname : `/${pathname}`, `${target}/`).toString();
const latencies = [];
let cursor = 0;
let successes = 0;
let failures = 0;
const statusCounts = new Map();

function percentile(sorted, percentileValue) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= requests) return;
    const started = performance.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'laundry-staging-load-smoke/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const elapsed = performance.now() - started;
      latencies.push(elapsed);
      statusCounts.set(response.status, (statusCounts.get(response.status) ?? 0) + 1);
      await response.arrayBuffer();
      if (response.ok) successes += 1;
      else failures += 1;
    } catch {
      latencies.push(performance.now() - started);
      failures += 1;
      statusCounts.set('network/timeout', (statusCounts.get('network/timeout') ?? 0) + 1);
    }
  }
}

const wallStarted = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
const wallMs = performance.now() - wallStarted;
const sorted = [...latencies].sort((a, b) => a - b);
const errorRate = failures / requests;
const rps = requests / (wallMs / 1000);

console.log(JSON.stringify({
  target: url,
  requests,
  concurrency,
  successes,
  failures,
  errorRate: Number(errorRate.toFixed(4)),
  requestsPerSecond: Number(rps.toFixed(2)),
  latencyMs: {
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    p99: Math.round(percentile(sorted, 99)),
    max: Math.round(sorted.at(-1) ?? 0),
  },
  statusCounts: Object.fromEntries(statusCounts),
}, null, 2));

const p95 = percentile(sorted, 95);
if (errorRate > maxErrorRate) {
  console.error(`FAIL: tasa de error ${(errorRate * 100).toFixed(2)}% > ${(maxErrorRate * 100).toFixed(2)}%.`);
  process.exit(1);
}
if (p95 > maxP95Ms) {
  console.error(`FAIL: p95 ${Math.round(p95)}ms > ${maxP95Ms}ms.`);
  process.exit(1);
}
console.log('PASS: smoke test dentro de los umbrales configurados.');
