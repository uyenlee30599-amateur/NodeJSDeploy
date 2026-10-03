const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createServer } = require('../app');
const { MemoryStore } = require('../test-support/memory-store');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlp8AAAAASUVORK5CYII=', 'base64');
const secret = 'deployment-test-secret-at-least-thirty-two-characters';

test('Production: React routes, API 404, Mongo image replacement/deletion and persistence across server restart', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab23-production-'));
  const store = new MemoryStore();
  await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html><div id="root">React application</div>');
  const start = async () => {
    const services = createServer({ store, jwtSecret: secret, serveClient: true, clientDir: dir });
    services.httpServer.listen(0, '127.0.0.1'); await once(services.httpServer, 'listening');
    return { ...services, base: `http://127.0.0.1:${services.httpServer.address().port}` };
  };
  let services = await start();
  const stop = () => new Promise(resolve => services.io.close(resolve));
  const call = async (route, method = 'GET', body, token) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const response = await fetch(services.base + route, { method, headers, body });
    assert.ok(response.ok, await response.clone().text()); return response.json();
  };
  const form = () => {
    const body = new FormData(); body.append('title', 'Production post'); body.append('content', 'Production content saved in database.');
    body.append('image', new Blob([png], { type: 'image/png' }), 'test.png'); return body;
  };
  try {
    for (const route of ['/', '/login', '/signup', '/posts/123']) {
      const response = await fetch(services.base + route); assert.equal(response.status, 200); assert.match(await response.text(), /React application/);
    }
    for (const route of ['/auth/missing', '/images/missing.png', '/assets/missing.js']) {
      const response = await fetch(services.base + route); assert.equal(response.status, 404); assert.match(response.headers.get('content-type'), /json/);
    }
    assert.deepEqual(await call('/health'), { status: 'ok' });
    await call('/auth/signup', 'PUT', { email: 'deploy@example.com', password: 'password123', name: 'Deploy Test' });
    const { token } = await call('/auth/login', 'POST', { email: 'deploy@example.com', password: 'password123' });
    const missing = await fetch(services.base + '/feed/missing', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(missing.status, 404); assert.match(missing.headers.get('content-type'), /json/);
    const { post } = await call('/feed/post', 'POST', form(), token);
    assert.equal(store.images.size, 1);
    await stop(); services = await start();
    const image = await fetch(services.base + post.imageUrl); assert.equal(image.status, 200); assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    assert.equal((await call(`/feed/posts/${post._id}`, 'GET', undefined, token)).post.imageUrl, post.imageUrl);
    const replaced = await call(`/feed/post/${post._id}`, 'PUT', form(), token);
    assert.notEqual(replaced.post.imageUrl, post.imageUrl); assert.equal(store.images.size, 1);
    assert.equal((await fetch(services.base + post.imageUrl)).status, 404);
    await call(`/feed/post/${post._id}`, 'DELETE', undefined, token);
    assert.equal(store.images.size, 0); assert.equal((await fetch(services.base + replaced.post.imageUrl)).status, 404);
  } finally { await stop(); await fs.rm(dir, { recursive: true, force: true }); }
});
