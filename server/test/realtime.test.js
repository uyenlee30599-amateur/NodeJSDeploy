const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { io: connect } = require('socket.io-client');
const { createServer } = require('../app');
const { MemoryStore } = require('../test-support/memory-store');
function once(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handle); reject(new Error(`Timeout: ${event}`)); }, 5000);
    function handle(value) { if (!predicate(value)) return; clearTimeout(timer); socket.off(event, handle); resolve(value); }
    socket.on(event, handle);
  });
}
test('Hai kết nối Socket.IO nhận create/update/delete, dữ liệu creator và phân quyền', async () => {
  const store = new MemoryStore(), secret = 'realtime-test-secret-at-least-thirty-two-characters';
  const owner = await store.createUser({ name: 'Owner', email: 'owner@example.com', password: 'private' });
  const viewer = await store.createUser({ name: 'Viewer', email: 'viewer@example.com', password: 'private' });
  const token = jwt.sign({}, secret, { subject: owner._id, expiresIn: '1h' });
  const viewerToken = jwt.sign({}, secret, { subject: viewer._id, expiresIn: '1h' });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab22-realtime-'));
  const { httpServer, io } = createServer({ store, jwtSecret: secret, uploadDir: dir, imageStorage: 'local' });
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${httpServer.address().port}`, sockets = [];
  function socket(authToken, transports = ['websocket']) { const s = connect(base, { auth: { token: authToken }, transports, forceNew: true, autoConnect: false, reconnection: false }); sockets.push(s); return s; }
  async function call(route, method, body, authToken = token) {
    const res = await fetch(base + route, { method, headers: { Authorization: `Bearer ${authToken}` }, body }); return { status: res.status, data: await res.json() };
  }
  const form = (title = 'Realtime first post', image = true) => {
    const f = new FormData(); f.append('title', title); f.append('content', 'Realtime post content');
    if (image) f.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlp8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'test.png'); return f;
  };
  try {
    const a = socket(token), b = socket(viewerToken, ['polling', 'websocket']);
    const connected = Promise.all([once(a, 'connect'), once(b, 'connect')]); a.connect(); b.connect(); await connected;
    const denied = socket('invalid-token'); const deniedEvent = once(denied, 'connect_error'); denied.connect(); assert.equal((await deniedEvent).data.status, 401);
    const expired = socket(jwt.sign({}, secret, { subject: owner._id, expiresIn: -1 })); const expiredEvent = once(expired, 'connect_error'); expired.connect(); assert.equal((await expiredEvent).data.status, 401);
    const eventsA = [], eventsB = []; a.on('posts', event => eventsA.push(event)); b.on('posts', event => eventsB.push(event));
    let received = Promise.all([once(a, 'posts'), once(b, 'posts')]);
    const created = await call('/feed/post', 'POST', form()); assert.equal(created.status, 201);
    const postId = created.data.post._id;
    for (const event of await received) { assert.equal(event.action, 'create'); assert.equal(event.post._id, postId); assert.deepEqual(event.post.creator, { _id: owner._id, name: 'Owner' }); assert.equal(event.post.creator.password, undefined); }
    // REST lỗi quyền và dữ liệu không được phát sự kiện posts.
    assert.equal((await call(`/feed/post/${postId}`, 'PUT', form('Forbidden edit', false), viewerToken)).status, 403);
    assert.equal((await call(`/feed/post/${postId}`, 'DELETE', null, viewerToken)).status, 403);
    assert.equal((await call(`/feed/post/${postId}`, 'PUT', form('x', false))).status, 422);
    const barrier = Promise.all([once(a, 'barrier'), once(b, 'barrier')]); io.emit('barrier'); await barrier;
    assert.equal(eventsA.length, 1); assert.equal(eventsB.length, 1);
    received = Promise.all([once(a, 'posts', e => e.action === 'update'), once(b, 'posts', e => e.action === 'update')]);
    assert.equal((await call(`/feed/post/${postId}`, 'PUT', form('Updated on all clients', false))).status, 200);
    for (const event of await received) { assert.equal(event.post.title, 'Updated on all clients'); assert.equal(event.post.creator._id, owner._id); assert.equal(event.post.creator.name, 'Owner'); }
    // Client B mất kết nối, sau đó nhận được dữ liệu mới nhất qua GET khi kết nối lại.
    b.disconnect(); await call(`/feed/post/${postId}`, 'PUT', form('Changed while offline', false));
    const reconnected = once(b, 'connect'); b.connect(); await reconnected;
    assert.equal((await call('/feed/posts', 'GET')).data.posts[0].title, 'Changed while offline');
    received = Promise.all([once(a, 'posts', e => e.action === 'delete'), once(b, 'posts', e => e.action === 'delete')]);
    assert.equal((await call(`/feed/post/${postId}`, 'DELETE')).status, 200);
    for (const event of await received) assert.deepEqual(event, { action: 'delete', post: postId });
    assert.equal((await call('/feed/posts', 'GET')).data.posts.length, 0); assert.deepEqual(await fs.readdir(dir), []);
  } finally { sockets.forEach(socket => socket.disconnect()); await new Promise(resolve => io.close(resolve)); await fs.rm(dir, { recursive: true, force: true }); }
});
