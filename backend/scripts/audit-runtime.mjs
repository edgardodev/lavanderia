import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8'));
const packages = lock.packages ?? {};

function resolveDependency(parentPath, dependencyName) {
  const candidates = [];
  let current = parentPath;
  while (true) {
    candidates.push(current ? `${current}/node_modules/${dependencyName}` : `node_modules/${dependencyName}`);
    if (!current) break;
    const marker = current.lastIndexOf('/node_modules/');
    current = marker < 0 ? '' : current.slice(0, marker);
  }
  return candidates.find((candidate) => packages[candidate]);
}

const runtimeReachable = new Set();
const queue = [];
for (const name of Object.keys(packageJson.dependencies ?? {})) {
  const node = resolveDependency('', name);
  if (node) queue.push(node);
}

while (queue.length) {
  const node = queue.shift();
  if (!node || runtimeReachable.has(node)) continue;
  runtimeReachable.add(node);
  const entry = packages[node] ?? {};
  const dependencies = {
    ...(entry.dependencies ?? {}),
    ...(entry.optionalDependencies ?? {}),
  };
  for (const dependencyName of Object.keys(dependencies)) {
    const child = resolveDependency(node, dependencyName);
    if (child && !runtimeReachable.has(child)) queue.push(child);
  }
}

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
const buildOnly = [];

for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  if (!serious.has(vulnerability.severity)) continue;
  const nodes = Array.isArray(vulnerability.nodes) ? vulnerability.nodes : [];
  const runtimeNodes = nodes.filter((node) => runtimeReachable.has(node));
  if (runtimeNodes.length > 0) {
    failures.push({ name, severity: vulnerability.severity, nodes: runtimeNodes });
  } else {
    buildOnly.push({ name, severity: vulnerability.severity, nodes });
  }
}

if (buildOnly.length) {
  console.log('Avisos high/critical no alcanzables desde dependencies de producción:');
  for (const item of buildOnly) console.log(`- ${item.severity}: ${item.name}`);
}

if (failures.length) {
  console.error('Vulnerabilidades high/critical alcanzables desde dependencias de runtime:');
  for (const item of failures) {
    console.error(`- ${item.severity}: ${item.name} (${item.nodes.join(', ')})`);
  }
  process.exit(1);
}

console.log(`Audit runtime OK: ${runtimeReachable.size} paquetes alcanzables, sin high/critical.`);
