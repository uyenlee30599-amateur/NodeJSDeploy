export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5023');
export const imageUrl = value => `${API_URL}${value}`;
export async function request(path, { token, body, method = 'GET', signal } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(`${API_URL}${path}`, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined, signal }); }
  catch (error) { if (error.name === 'AbortError') throw error; throw new Error('Không kết nối được server. Vui lòng thử lại sau.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event('auth-expired'));
    const error = new Error(data.message || 'Yêu cầu thất bại.');
    error.fields = Object.fromEntries((data.errors || []).map(e => [e.field, e.message]));
    error.status = response.status;
    throw error;
  }
  return data;
}
