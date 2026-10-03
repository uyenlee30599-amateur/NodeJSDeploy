const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');
const { MemoryStore } = require('../test-support/memory-store');
let server, base, dir, token, otherToken, userId, postId, originalImage;
const secret = 'test-secret-with-at-least-thirty-two-characters';
const store = new MemoryStore();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlp8AAAAASUVORK5CYII=', 'base64');
before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab21-api-'));
  server = createApp({ store, jwtSecret: secret, uploadDir: dir, imageStorage: 'local' }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(dir, { recursive: true, force: true }); });
async function call(url, { method = 'GET', body, auth = token, headers = {} } = {}) {
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const response = await fetch(base + url, { method, body, headers });
  return { status: response.status, headers: response.headers, data: await response.json() };
}
function form({ title = 'My first post', content = 'Hello from REST API!', image = png, mime = 'image/png' } = {}) {
  const body = new FormData(); body.append('title', title); body.append('content', content);
  if (image) body.append('image', new Blob([image], { type: mime }), 'test.png'); return body;
}
test('CORS preflight cho React ở port 3023 và endpoint health', async () => {
  const health = await call('/health', { headers: { Origin: 'http://localhost:3023' } });
  assert.equal(health.status, 200); assert.equal(health.headers.get('access-control-allow-origin'), 'http://localhost:3023');
  const response = await fetch(base + '/feed/post', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3023', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization' } });
  assert.equal(response.status, 204); assert.match(response.headers.get('access-control-allow-methods'), /PUT/);
});
test('Signup validate, hash mật khẩu, chuẩn hóa email và chặn trùng', async () => {
  assert.equal((await call('/auth/signup', { method: 'PUT', body: { email: 'wrong', name: 'a', password: '123' } })).status, 422);
  const user = { email: 'USER@Example.com', name: 'Test User', password: 'password123' };
  const response = await call('/auth/signup', { method: 'PUT', body: user });
  assert.equal(response.status, 201); userId = response.data.user._id;
  assert.equal(response.data.user.email, 'user@example.com'); assert.equal(response.data.user.password, undefined);
  assert.notEqual((await store.findUser(userId)).password, user.password);
  assert.equal((await call('/auth/signup', { method: 'PUT', body: user })).status, 409);
});
test('Login đúng/sai, token hết hạn, dữ liệu tài khoản và status', async () => {
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: 'user@example.com', password: 'wrongpass' } })).status, 401);
  const login = await call('/auth/login', { method: 'POST', body: { email: 'user@example.com', password: 'password123' } });
  assert.equal(login.status, 200); token = login.data.token;
  assert.equal((await call('/auth/me')).data.user.name, 'Test User');
  assert.equal((await call('/feed/posts', { auth: '' })).status, 401);
  assert.equal((await call('/feed/posts', { auth: jwt.sign({}, secret, { subject: userId, expiresIn: -1 }) })).status, 401);
  assert.equal((await call('/auth/status', { method: 'PATCH', body: { status: '' } })).status, 422);
  assert.equal((await call('/auth/status', { method: 'PATCH', body: { status: 'Learning NodeJS' } })).status, 200);
  assert.equal((await call('/auth/me')).data.user.status, 'Learning NodeJS');
});
test('Tạo bài validate tiêu đề/nội dung, bắt buộc ảnh, MIME và kích thước', async () => {
  assert.equal((await call('/feed/posts')).data.posts.length, 0);
  assert.equal((await call('/feed/post', { method: 'POST', body: form({ title: 'a' }) })).status, 422);
  assert.equal((await call('/feed/post', { method: 'POST', body: form({ image: null }) })).status, 422);
  assert.equal((await call('/feed/post', { method: 'POST', body: form({ image: 'fake png' }) })).status, 422);
  assert.equal((await call('/feed/post', { method: 'POST', body: form({ mime: 'text/plain' }) })).status, 422);
  assert.equal((await call('/feed/post', { method: 'POST', body: form({ image: Buffer.alloc(5 * 1024 * 1024 + 1) }) })).status, 413);
  assert.deepEqual(await fs.readdir(dir), []);
});
test('Tạo bài, danh sách, chi tiết và route ảnh', async () => {
  const result = await call('/feed/post', { method: 'POST', body: form() });
  assert.equal(result.status, 201); postId = result.data.post._id; originalImage = result.data.post.imageUrl;
  assert.equal(result.data.post.creator._id, userId);
  assert.equal((await call('/feed/posts')).data.totalItems, 1);
  assert.equal((await call(`/feed/posts/${postId}`)).data.post.content, 'Hello from REST API!');
  const image = await fetch(base + originalImage); assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /image\/png/); assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
});
test('Chặn tài khoản khác sửa/xóa và ID sai/không tồn tại', async () => {
  await call('/auth/signup', { method: 'PUT', body: { email: 'other@example.com', name: 'Other User', password: 'password123' } });
  otherToken = (await call('/auth/login', { method: 'POST', body: { email: 'other@example.com', password: 'password123' } })).data.token;
  assert.equal((await call(`/feed/post/${postId}`, { method: 'PUT', auth: otherToken, body: form() })).status, 403);
  assert.equal((await call(`/feed/post/${postId}`, { method: 'DELETE', auth: otherToken })).status, 403);
  assert.equal((await call('/feed/posts/not-an-id')).status, 400);
  assert.equal((await call('/feed/posts/' + new ObjectId())).status, 404);
  assert.equal((await fs.readdir(dir)).length, 1);
});
test('Edit giữ ảnh cũ, thay ảnh dọn file cũ, Delete xóa DB và file', async () => {
  const edited = await call(`/feed/post/${postId}`, { method: 'PUT', body: form({ title: 'Updated title', image: null }) });
  assert.equal(edited.status, 200); assert.equal(edited.data.post.imageUrl, originalImage);
  const replaced = await call(`/feed/post/${postId}`, { method: 'PUT', body: form({ title: 'Replace image' }) });
  assert.equal(replaced.status, 200); assert.notEqual(replaced.data.post.imageUrl, originalImage);
  assert.equal((await fetch(base + originalImage)).status, 404); assert.equal((await fs.readdir(dir)).length, 1);
  assert.equal((await call(`/feed/post/${postId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await call('/feed/posts')).data.posts.length, 0); assert.deepEqual(await fs.readdir(dir), []);
});
