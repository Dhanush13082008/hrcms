let token = sessionStorage.getItem('haven_token');
export function setToken(value) {
  token = value;
  if (value) sessionStorage.setItem('haven_token', value);
  else sessionStorage.removeItem('haven_token');
}
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch('/api' + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(
      'Cannot reach the server. Please check your connection and try again.',
    );
  }
  const data = await response
    .json()
    .catch(() => ({ error: 'Unexpected server response' }));
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login')
      window.dispatchEvent(new Event('haven:expired'));
    throw new Error(data.error || 'Request failed');
  }
  return data;
}
