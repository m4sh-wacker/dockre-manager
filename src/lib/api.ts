// All API requests go to the Go backend (command-based Docker manager).
// The base URL is configurable via NEXT_PUBLIC_API_URL and defaults to the
// local backend on port 3030.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3030';

function getAuthHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('docker-auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.token) {
        return { Authorization: `Bearer ${parsed.state.token}` };
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return {};
}

/**
 * Perform an authenticated request against the Go backend.
 */
export async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const hasBody = options.body !== undefined && options.body !== null;

  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...((options.headers as Record<string, string>) || {}),
  };

  // Only set Content-Type for requests with a body
  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
