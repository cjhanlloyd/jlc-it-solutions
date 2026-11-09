// The one way admin tabs call the API: bearer auth, JSON in and out, server error text surfaced.
export async function adminApi<T = any>(path: string, token: string, body?: unknown, fallbackError = 'Request failed.'): Promise<T> {
  const response = await fetch(path, body === undefined
    ? { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    : { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || fallbackError);
  return data;
}
