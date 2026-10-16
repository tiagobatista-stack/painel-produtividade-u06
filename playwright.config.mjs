import { defineConfig, devices } from '@playwright/test';

// Sem SITE_URL: constrói public/ e o serve localmente (o que se testa é o que a Vercel publica).
// Com SITE_URL: roda os mesmos testes contra o endereço informado (ex.: a produção ou um Preview).
//   PowerShell:  $env:SITE_URL = "https://SEU-PROJETO.vercel.app"; npm run test:e2e
//   PW_CHANNEL=msedge usa o Edge instalado em vez do Chromium do Playwright.
const SITE_URL = process.env.SITE_URL?.replace(/\/+$/, '');
const PORTA = 4173;
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: SITE_URL ?? `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Cuiaba',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, channel } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 }, channel } },
  ],
  webServer: SITE_URL
    ? undefined
    : {
        command: 'npm run build && node scripts/serve.mjs public',
        url: `http://localhost:${PORTA}`,
        env: { PORT: String(PORTA) },
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
