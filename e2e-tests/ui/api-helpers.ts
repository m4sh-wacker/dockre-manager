// API helpers used ONLY for test setup / cleanup (not for assertions).
//
// The actual journey is driven through the browser. These thin HTTP helpers
// talk to the Go backend directly so we can guarantee a clean, repeatable
// starting state (admin password) and tidy up the container we create.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const BACKEND = process.env.E2E_BASE_URL || 'http://localhost:3030';

export const ADMIN_USER = process.env.E2E_USERNAME || 'admin';
export const ORIG_PASSWORD = process.env.E2E_PASSWORD || 'admin123';
// The password the journey changes the account TO (and then restores from).
export const NEW_PASSWORD = process.env.E2E_NEW_PASSWORD || 'NewE2EPass123!';

// Try to log in; return a JWT token or null on failure.
async function tryLogin(password: string): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

async function changePassword(token: string, current: string, next: string): Promise<boolean> {
  const res = await fetch(`${BACKEND}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_password: current, new_password: next }),
  });
  return res.ok;
}

// Ensure the admin account password equals `desired`, whatever state a previous
// (possibly crashed) run left it in. Self-healing so the suite is repeatable.
export async function ensureAdminPassword(desired: string): Promise<void> {
  if (await tryLogin(desired)) return; // already correct

  // Try the "other" known password and switch back.
  const other = desired === ORIG_PASSWORD ? NEW_PASSWORD : ORIG_PASSWORD;
  const token = await tryLogin(other);
  if (token) {
    await changePassword(token, other, desired);
    return;
  }
  throw new Error(
    `Cannot reach backend or admin password is unknown (tried "${desired}" and "${other}"). ` +
    `Is the backend running at ${BACKEND}?`,
  );
}

type ProjectGroup = {
  name: string;
  containers: { id: string; name: string }[];
};

// Best-effort removal of every container in a project (used for cleanup).
export async function removeProjectContainers(project: string): Promise<void> {
  const token = (await tryLogin(NEW_PASSWORD)) || (await tryLogin(ORIG_PASSWORD));
  if (!token) return;

  const res = await fetch(`${BACKEND}/api/containers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;

  const groups = (await res.json()) as ProjectGroup[];
  const group = groups.find((g) => g.name?.toLowerCase() === project.toLowerCase());
  if (!group) return;

  for (const c of group.containers || []) {
    await fetch(`${BACKEND}/api/containers/${c.id}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
}

// Fully tear a compose project down — containers AND the `<project>_default`
// network AND volumes. Removing the API containers alone leaks the network,
// which eventually exhausts Docker's address pool ("all predefined address
// pools have been fully subnetted"). Best-effort; ignores errors.
export async function composeDown(project: string): Promise<void> {
  await execFileAsync('docker', ['compose', '-p', project, 'down', '-v', '--remove-orphans'])
    .catch(() => undefined);
  // Safety net in case the network outlived the project record.
  await execFileAsync('docker', ['network', 'rm', `${project}_default`]).catch(() => undefined);
}

// Reclaim any networks left behind by previous/aborted runs so the address
// pool never fills up. Safe: `network prune` only removes unused networks.
export async function pruneNetworks(): Promise<void> {
  await execFileAsync('docker', ['network', 'prune', '-f']).catch(() => undefined);
}
