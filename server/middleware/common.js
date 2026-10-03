const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { ObjectId } = require('mongodb');
const fail = (status, message, errors) => Object.assign(new Error(message), { status, errors });
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function validate(req, _res, next) {
  const errors = validationResult(req);
  next(errors.isEmpty() ? undefined : fail(422, 'Dữ liệu không hợp lệ.', errors.array().map(e => ({ field: e.path, message: e.msg }))));
}
function isAuth(req, _res, next) {
  try {
    const header = req.get('Authorization') || '';
    if (!header.startsWith('Bearer ')) throw new Error();
    const payload = jwt.verify(header.slice(7), req.app.locals.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || !ObjectId.isValid(payload.sub)) throw new Error();
    req.userId = payload.sub;
    next();
  } catch { next(fail(401, 'Vui lòng đăng nhập lại.')); }
}
function validId(req, _res, next) {
  next(/^[a-f\d]{24}$/i.test(req.params.id) ? undefined : fail(400, 'ID bài viết không hợp lệ.'));
}
module.exports = { fail, asyncRoute, validate, isAuth, validId };
