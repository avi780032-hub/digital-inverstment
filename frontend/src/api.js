const get = () => localStorage.getItem('token');
export async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(get() && { Authorization: 'Bearer ' + get() }) }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { if (res.status === 401 && get()) { localStorage.removeItem('token'); location.href = '/'; } throw new Error(data.error || 'Request failed'); }
  return data;
}
export const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const day = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
