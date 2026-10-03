const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { fail } = require('../middleware/common');
const publicUser = user => ({ _id: String(user._id), name: user.name, email: user.email, status: user.status });
exports.signup = async (req, res) => {
  const store = req.app.locals.store;
  if (await store.findUserByEmail(req.body.email)) throw fail(409, 'E-mail đã được sử dụng.');
  const password = await bcrypt.hash(req.body.password, 12);
  try {
    const user = await store.createUser({ email: req.body.email, name: req.body.name, password, status: 'I am new!', createdAt: new Date() });
    res.status(201).json({ message: 'Đăng ký thành công. Hãy đăng nhập.', user: publicUser(user) });
  } catch (error) { if (error.code === 11000) throw fail(409, 'E-mail đã được sử dụng.'); throw error; }
};
exports.login = async (req, res) => {
  const user = await req.app.locals.store.findUserByEmail(req.body.email);
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) throw fail(401, 'E-mail hoặc mật khẩu không đúng.');
  const token = jwt.sign({}, req.app.locals.jwtSecret, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256' });
  res.json({ token, user: publicUser(user), expiresIn: 3600 });
};
exports.me = async (req, res) => {
  const user = await req.app.locals.store.findUser(req.userId);
  if (!user) throw fail(401, 'Tài khoản không còn tồn tại.');
  res.json({ user: publicUser(user) });
};
exports.status = async (req, res) => {
  if (!await req.app.locals.store.findUser(req.userId)) throw fail(401, 'Tài khoản không còn tồn tại.');
  await req.app.locals.store.updateStatus(req.userId, req.body.status);
  res.json({ message: 'Đã cập nhật trạng thái.', status: req.body.status });
};
