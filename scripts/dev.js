'use strict';

const net = require('net');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env file (only set keys that aren't already in process.env)
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(preferred, label, maxTries = 10) {
  for (let port = preferred; port < preferred + maxTries; port++) {
    if (await isPortAvailable(port)) {
      if (port !== preferred)
        console.log(`  ⚠  Port ${preferred} in use → using ${port} for ${label}`);
      return port;
    }
  }
  throw new Error(`No available port near ${preferred} for ${label}`);
}

async function main() {
  loadEnv();

  const isMobile = process.argv.includes('--mobile');
  const preferredFrontend = parseInt(process.env.FRONTEND_PORT || '3005', 10);
  const preferredProxy = parseInt(process.env.PROXY_PORT || '3006', 10);

  console.log('🔍 Checking port availability...');
  const frontendPort = await findAvailablePort(preferredFrontend, 'frontend');
  const proxyPort = await findAvailablePort(preferredProxy, 'proxy server');

  // Finalize env vars before spawning child processes
  process.env.FRONTEND_PORT = String(frontendPort);
  process.env.PROXY_PORT = String(proxyPort);
  process.env.PROXY_URL = `http://localhost:${proxyPort}`;

  console.log('');
  console.log('🚀 Starting development servers');
  console.log(`   Frontend  → http://localhost:${frontendPort}`);
  console.log(`   Proxy     → http://localhost:${proxyPort}`);
  console.log('');

  const root = path.resolve(__dirname, '..');
  const webpackBin = path.join(root, 'node_modules', '.bin', 'webpack');
  const tsxBin = path.join(root, 'node_modules', '.bin', 'tsx');

  const webpackArgs = ['serve', '--mode', 'development'];
  if (isMobile) {
    webpackArgs.push('--host', '0.0.0.0', '--allowed-hosts', 'all');
  }

  const env = { ...process.env };

  const webpackProc = spawn(webpackBin, webpackArgs, { stdio: 'inherit', env, cwd: root });
  const tsxProc = spawn(tsxBin, ['watch', 'server/index.ts'], { stdio: 'inherit', env, cwd: root });

  function cleanup() {
    webpackProc.kill();
    tsxProc.kill();
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  webpackProc.on('exit', (code) => { if (code !== 0 && code !== null) process.exit(code); });
  tsxProc.on('exit', (code) => { if (code !== 0 && code !== null) process.exit(code); });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
