import { test, expect, Page } from '@playwright/test';
import {
  ADMIN_USER,
  ORIG_PASSWORD,
  NEW_PASSWORD,
  ensureAdminPassword,
  composeDown,
  pruneNetworks,
} from './api-helpers';

// A docker-compose-safe project name with a random 10-digit suffix, so
// collisions are extremely unlikely without needing any database/tracking.
const PROJECT = `e2eui${Math.floor(1e9 + Math.random() * 9e9)}`;

// When E2E_KEEP is set (1/true/yes), skip teardown so you can inspect the
// result afterwards in the UI (password stays changed, container stays up).
const KEEP = /^(1|true|yes)$/i.test(process.env.E2E_KEEP ?? '');

// ---------------------------------------------------------------------------
// Setup / teardown — keep the admin account and Docker state repeatable.
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  // Loud diagnostic so it's obvious whether E2E_KEEP reached this process and
  // whether this (updated) version of the file is the one running.
  console.log(`[e2e] E2E_KEEP=${JSON.stringify(process.env.E2E_KEEP)} -> KEEP=${KEEP}`);

  // Whatever a previous (maybe crashed) run left behind, make sure we start
  // with the known original password so the UI login below works.
  await ensureAdminPassword(ORIG_PASSWORD);

  // Reclaim leaked networks from earlier runs so Docker's address pool can't
  // fill up ("all predefined address pools have been fully subnetted").
  await pruneNetworks();
});

test.afterAll(async () => {
  // Restore the password and remove the container we created, so the next run
  // starts clean. Best-effort — never fail the suite on cleanup.
  // Skipped entirely when E2E_KEEP=1 so the traces are left for inspection.
  if (KEEP) {
    console.log(
      `\n[e2e] E2E_KEEP=1 — leaving traces in place:\n` +
      `      • admin password is now "${NEW_PASSWORD}" (not restored)\n` +
      `      • container/project "${PROJECT}" is still deployed (stopped)\n`,
    );
    return;
  }
  await ensureAdminPassword(ORIG_PASSWORD).catch(() => undefined);
  // Tear the whole project down (containers + network + volumes), not just the
  // containers, so we never leak the `<project>_default` network.
  await composeDown(PROJECT).catch(() => undefined);
});

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------

async function login(page: Page, username: string, password: string) {
  await page.goto('/');
  // The app shows a ~500ms splash, then the login form.
  await page.locator('#username').waitFor({ state: 'visible' });
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  // After a successful login the dashboard sidebar appears.
  await expect(page.getByRole('button', { name: /Settings/ })).toBeVisible();
}

async function gotoTab(page: Page, name: RegExp) {
  await page.getByRole('button', { name }).click();
}

// ---------------------------------------------------------------------------
// The full journey: open app → login → change password → create a service
// from a template → stop it.
// ---------------------------------------------------------------------------

test('login → change password → deploy from template → stop it', async ({ page }) => {
  // 1) Open the app and log in with the original credentials.
  await test.step('login', async () => {
    await login(page, ADMIN_USER, ORIG_PASSWORD);
  });

  // 2) Go to Settings and change the password.
  await test.step('change password', async () => {
    await gotoTab(page, /Settings/);

    await page.locator('#currentPassword').fill(ORIG_PASSWORD);
    await page.locator('#newPassword').fill(NEW_PASSWORD);
    await page.locator('#confirmPassword').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Update Password' }).click();

    // Success toast from settings-page.tsx. Sonner renders the title twice (a
    // visible node + an aria-live status node), so scope to the first match.
    await expect(page.getByText('Password Updated').first()).toBeVisible();
  });

  // 3) Open the "Create New Service" modal and deploy from the first template.
  await test.step('deploy from template', async () => {
    await gotoTab(page, /Services/);
    await page.getByRole('button', { name: 'Create New Service' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Name the project.
    await dialog.locator('#projectName').fill(PROJECT);

    // Quick Deploy is the default tab. Pick the first available template card
    // (template cards are the buttons that contain an <h4> title).
    const firstTemplate = dialog.locator('button:has(h4)').first();
    await expect(firstTemplate).toBeVisible();
    await firstTemplate.click();

    // Deploy and wait for the success toast (compose up can be slow).
    await dialog.getByRole('button', { name: 'Deploy' }).click();
    await expect(page.getByText('Service Deployed').first()).toBeVisible({ timeout: 180_000 });
  });

  // 4) Find the new service, open it, and stop it.
  await test.step('stop the service', async () => {
    // Open the service detail page (the card button carries the project name).
    const serviceCard = page.getByRole('button', { name: new RegExp(PROJECT, 'i') });
    await expect(serviceCard).toBeVisible({ timeout: 30_000 });
    await serviceCard.click();

    // We're on the detail page; confirm the title.
    await expect(page.getByRole('heading', { name: PROJECT })).toBeVisible();

    // Click "Stop" (the Square icon button). The first one is "Stop all".
    await page.locator('button:has(svg.lucide-square)').first().click();

    // A "stopped" toast confirms the action.
    await expect(page.getByText(/stopped/i).first()).toBeVisible({ timeout: 60_000 });
  });
});
