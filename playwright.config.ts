import { readFileSync } from 'fs'
import { defineConfig, devices } from '@playwright/test'

// End-to-end tests drive the real app against real services: TypeSafe Jev, Groq/Ollama, and
// Neon Postgres + Object Storage. They run against the isolated `e2e` Neon branch, never
// production: `neon branch create --name e2e --parent production` once, then
// `neon env pull --branch e2e --file .env.e2e.local`. The app's own API keys come from .env.local.
// The suite builds the app and serves it with `next start` on its own port, with the e2e
// branch's variables taking precedence over .env.local.

const PORT = 3100
const e2eEnv = parseEnvFile('.env.e2e.local')
if (!e2eEnv.DATABASE_URL || !e2eEnv.NEON_BRANCH) {
  throw new Error('Missing .env.e2e.local. Run: neon env pull --branch e2e --file .env.e2e.local')
}
if (e2eEnv.NEON_BRANCH === 'production') throw new Error('Refusing to run e2e tests against the production branch.')

export default defineConfig({
  testDir: './e2e',
  workers: 1, // one shared test database; flows run one after another
  fullyParallel: false,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome', // the installed Chrome; no browser download needed
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, grep: /@mobile/ }
  ],
  webServer: {
    command: `pnpm build && pnpm exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    env: e2eEnv,
    reuseExistingServer: false,
    timeout: 300_000
  }
})

function parseEnvFile(path: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')])
    )
  } catch {
    return {}
  }
}
