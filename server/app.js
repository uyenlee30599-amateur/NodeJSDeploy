const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const express = require('express');
const fs = require('node:fs');
const { asyncRoute } = require('./middleware/common');
const cors = require('cors');
const multer = require('multer');
const { connectStore } = require('./models/store');
const { createServer: createHttpServer } = require('node:http');
const { initSocket } = require('./socket');
function createApp({ store, jwtSecret = process.env.JWT_SECRET, uploadDir = path.join(__dirname, 'uploads'), clientOrigin = process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3023', imageStorage = 'mongo', clientDir = path.join(__dirname, '..', 'client', 'dist'), serveClient = process.env.NODE_ENV === 'production' } = {}) {
  if (!store) throw new Error('Cần kết nối database trước khi khởi tạo ứng dụng.');
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET cần ít nhất 32 ký tự.');
  if (!['mongo', 'local'].includes(imageStorage)) throw new Error('imageStorage không hợp lệ.');
  if (serveClient && !fs.existsSync(path.join(clientDir, 'index.html'))) throw new Error('Cần npm run build trước khi chạy production.');
  const app = express();
  Object.assign(app.locals, { store, jwtSecret, uploadDir, clientOrigin, imageStorage });
  app.disable('x-powered-by');
  app.use(cors({ origin: clientOrigin, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '64kb' }));
  app.get('/health', asyncRoute(async (_req, res) => {
    if (store.db) await store.db.command({ ping: 1 });
    res.json({ status: 'ok' });
  }));
  if (imageStorage === 'mongo') {
    app.get('/images/:name', asyncRoute(async (req, res) => {
      if (!/^[a-f\d-]+\.(png|jpg|webp)$/.test(req.params.name)) return res.status(404).json({ message: 'Không tìm thấy ảnh.' });
      const image = await store.findImage(req.params.name);
      if (!image) return res.status(404).json({ message: 'Không tìm thấy ảnh.' });
      res.set({ 'Content-Type': image.contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=86400' }).send(image.data);
    }));
  } else {
    app.use('/images', express.static(uploadDir, { dotfiles: 'deny', setHeaders(res) { res.set('X-Content-Type-Options', 'nosniff'); } }));
  }
  app.use('/auth', require('./routes/auth'));
  app.use('/feed', require('./routes/feed'));
  if (serveClient) {
    app.use(express.static(clientDir));
    // Chỉ các route của React dùng index.html, API/ảnh sai vẫn trả 404 JSON.
    app.get(['/', '/login', '/signup', '/posts/:id'], (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  }
  app.use((_req, res) => res.status(404).json({ message: 'Không tìm thấy đường dẫn.' }));
  app.use((error, _req, res, _next) => {
    let status = error.status || 500;
    let message = error.message;
    if (error instanceof multer.MulterError) { status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 422; message = error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh không được vượt quá 5 MB.' : 'Dữ liệu upload không hợp lệ.'; }
    if (status >= 500) { console.error(error); message = 'Lỗi server. Vui lòng thử lại.'; }
    res.status(status).json({ message, errors: error.errors || [] });
  });
  return app;
}
function createServer(options) {
  const app = createApp(options);
  const httpServer = createHttpServer(app);
  const io = initSocket(httpServer, app.locals);
  app.locals.io = io;
  return { app, httpServer, io };
}
if (require.main === module) {
  (async () => {
    const { store, client } = await connectStore();
    let services;
    try { services = createServer({ store }); } catch (error) { await client.close(); throw error; }
    const { httpServer, io } = services;
    httpServer.listen(Number(process.env.PORT) || 5000, '0.0.0.0', () => console.log('Lab23 NodeJS đang chạy ở cổng ' + (process.env.PORT || 5000)));
    httpServer.on('error', async error => { console.error(error.message); await client.close(); process.exitCode = 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      const deadline = setTimeout(() => process.exit(1), 10000); deadline.unref();
      io.close(async () => { await client.close(); clearTimeout(deadline); process.exit(0); });
    });
  })().catch(error => { console.error('Không thể khởi động:', error.message); process.exitCode = 1; });
}
module.exports = { createApp, createServer };
