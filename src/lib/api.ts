// API requests are routed to Go backend on port 3030

export async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  let authHeader: Record<string, string> = {};
  
  // Get auth token from localStorage
  try {
    const raw = localStorage.getItem('docker-auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.token) {
        authHeader = { Authorization: `Bearer ${parsed.state.token}` };
      }
    }
  } catch {
    // Ignore parsing errors
  }

  const method = (options.method || 'GET').toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;

  const headers: Record<string, string> = {
    ...authHeader,
    ...(options.headers as Record<string, string> || {}),
  };

  // Only set Content-Type for requests with body
  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Route to Go backend on port 3030
  const separator = path.includes('?') ? '&' : '?';
  const routedPath = `${path}${separator}XTransformPort=3030`;

  return fetch(routedPath, {
    ...options,
    headers,
  });
}

/**
 * Download a file from an API endpoint as a blob.
 */
export async function downloadRequest(path: string): Promise<Response> {
  let authHeader: Record<string, string> = {};
  
  try {
    const raw = localStorage.getItem('docker-auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.token) {
        authHeader = { Authorization: `Bearer ${parsed.state.token}` };
      }
    }
  } catch {
    // Ignore parsing errors
  }

  const separator = path.includes('?') ? '&' : '?';
  const routedPath = `${path}${separator}XTransformPort=3030`;

  return fetch(routedPath, {
    method: 'GET',
    headers: {
      ...authHeader,
    },
  });
}

/**
 * Trigger a browser download from an API response.
 */
export async function triggerDownload(response: Response, fallbackName: string): Promise<void> {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const contentDisposition = response.headers.get('Content-Disposition');
  const fileName = contentDisposition
    ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
    : fallbackName;
  
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
