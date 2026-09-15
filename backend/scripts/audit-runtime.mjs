import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const lock = JSON.parse(readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8'));
let raw = '';
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
} catch (error) {
  raw = String(error?.stdout ?? '');
  if (!raw.trim()) {
    console.error(String(error?.stderr ?? 'npm audit no produjo salida JSON.'));
    process.exit(2);
  }
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error('No se pudo interpretar la salida JSON de npm audit.');
  process.exit(2);
}

const serious = new Set(['high', 'critical']);
const failures = [];
const ignoredDevOnly = [];

for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  if (!serious.has(vulnerability.severity)) continue;
  const nodes = Array.isArray(vulnerability.nodes) ? vulnerability.nodes : [];
  const runtimeNodes = nodes.filter((node) => {
    const entry = lock.packages?.[node];
    return !entry || entry.dev !== true;
  });

  if (runtimeNodes.length > 0 || nodes.length === 0) {
    failures.push({ name, severity: vulnerability.severity, nodes: runtimeNodes.length ? runtimeNodes : nodes });
  } else {
    ignoredDevOnly.push({ name, severity: vulnerability.severity });
  }
}

if (ignoredDevOnly.length) {
  console.log('Avisos high/critical limitados exclusivamente a dependencias dev:');
  for (const item of ignoredDevOnly) console.log(`- ${item.severity}: ${item.name}`);
}

if (failures.length) {
  console.error('Vulnerabilidades high/critical presentes en dependencias de runtime:');
  for (const item of failures) {
    console.error(`- ${item.severity}: ${item.name}${item.nodes.length ? ` (${item.nodes.join(', ')})` : ''}`);
  }
  process.exit(1);
}

console.log('Audit runtime OK: sin vulnerabilidades high/critical desplegables.');
