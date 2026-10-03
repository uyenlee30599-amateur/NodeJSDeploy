// Kiểm tra HTTP thật với MongoDB. Dữ liệu tạo ra được dọn trong finally.
const assert = require('node:assert/strict');
const path = require('node:path');
const { io } = require('socket.io-client');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const base = process.env.SMOKE_BASE_URL || 'http://localhost:' + (process.env.PORT || 5000);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlp8AAAAASUVORK5CYII=', 'base64');
async function call(route, method, body, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined });
  const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
}
function form(title, image = true) { const f = new FormData(); f.append('title', title); f.append('content', 'Kiểm thử dữ liệu bài viết bằng MongoDB thật.'); if (image) f.append('image', new Blob([png], { type: 'image/png' }), 'sample.png'); return f; }
(async () => {
  const email = `smoke-${Date.now()}@example.com`, password = 'Lab23-test-password';
  let token, userId, postId;
  const sockets = [];
  function once(socket, event, predicate = () => true) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.off(event, listener); reject(new Error('Socket timeout: ' + event)); }, 5000);
      function listener(value) { if (!predicate(value)) return; clearTimeout(timer); socket.off(event, listener); resolve(value); }
      socket.on(event, listener);
    });
  }
  function events(action) { return Promise.all(sockets.map(socket => once(socket, 'posts', event => event.action === action))); }
  try {
    userId = (await call('/auth/signup', 'PUT', { email, password, name: 'Smoke Test' })).user._id;
    token = (await call('/auth/login', 'POST', { email, password })).token;
    for (let i = 0; i < 2; i++) {
      const socket = io(base, { auth: { token }, transports: ['websocket'], forceNew: true, autoConnect: false }); sockets.push(socket);
      const connected = once(socket, 'connect'); socket.connect(); await connected;
    }
    let received = events('create');
    const { post } = await call('/feed/post', 'POST', form('MongoDB test post'), token); postId = post._id;
    for (const event of await received) { assert.equal(event.post._id, postId); assert.equal(event.post.creator.name, 'Smoke Test'); }
    assert.equal((await call(`/feed/posts/${postId}`, 'GET', null, token)).post.title, 'MongoDB test post');
    const image = await fetch(base + post.imageUrl); assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    // Tương đương populate('creator'): tên mới nhất từ users, không lộ password.
    const dbClient = new MongoClient(process.env.MONGODB_URI);
    try { await dbClient.connect(); await dbClient.db(process.env.MONGODB_DB).collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { name: 'Updated Smoke User' } }); } finally { await dbClient.close(); }
    received = events('update');
    assert.equal((await call(`/feed/post/${postId}`, 'PUT', form('MongoDB updated post', false), token)).post.title, 'MongoDB updated post');
    for (const event of await received) { assert.equal(event.post.title, 'MongoDB updated post'); assert.equal(event.post.creator.name, 'Updated Smoke User'); assert.equal(event.post.creator._id, userId); assert.equal(event.post.creator.password, undefined); }
    received = events('delete');
    await call(`/feed/post/${postId}`, 'DELETE', null, token);
    for (const event of await received) assert.deepEqual(event, { action: 'delete', post: postId });
    postId = null;
    assert.equal((await fetch(base + post.imageUrl)).status, 404);
    console.log('PASS: MongoDB thật + 2 kết nối Socket.IO đồng thời nhận create/update/delete; creator đúng tên/ID; ảnh đã được dọn.');
  } finally {
    sockets.forEach(socket => socket.disconnect());
    if (postId && token) await call(`/feed/post/${postId}`, 'DELETE', null, token);
    if (userId) { const client = new MongoClient(process.env.MONGODB_URI); try { await client.connect(); await client.db(process.env.MONGODB_DB).collection('users').deleteOne({ _id: new ObjectId(userId) }); } finally { await client.close(); } }
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
