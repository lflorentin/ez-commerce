export async function api(path, options = {}) {
  const response = await fetch('/api/' + path, {
    ...options,
    headers: { ...options.headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Le service est indisponible.');
  return data;
}
