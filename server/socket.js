const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

// Gắn Socket.IO vào cùng HTTP server của REST API.
function initSocket(httpServer, { store, jwtSecret, clientOrigin }) {
  const io = new Server(httpServer, { cors: { origin: clientOrigin, methods: ['GET', 'POST'] } });
  io.use(async (socket, next) => {
    let payload;
    try {
      payload = jwt.verify(socket.handshake.auth.token, jwtSecret, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || !ObjectId.isValid(payload.sub) || !Number.isFinite(payload.exp)) throw new Error();
    } catch { const error = new Error('Vui lòng đăng nhập lại.'); error.data = { status: 401 }; return next(error); }
    try {
      if (!await store.findUser(payload.sub)) { const error = new Error('Tài khoản không còn tồn tại.'); error.data = { status: 401 }; return next(error); }
      socket.data.userId = payload.sub;
      socket.data.expiresAt = payload.exp * 1000;
      next();
    } catch { const error = new Error('Không thể xác thực kết nối.'); error.data = { status: 503 }; next(error); }
  });
  io.on('connection', socket => {
    const timeout = setTimeout(() => { socket.emit('auth-expired'); socket.disconnect(true); }, Math.max(0, socket.data.expiresAt - Date.now()));
    timeout.unref();
    socket.once('disconnect', () => clearTimeout(timeout));
    // Client chỉ nhận thông báo. Mọi thay đổi phải qua REST API và kiểm tra quyền.
  });
  return io;
}
module.exports = { initSocket };
