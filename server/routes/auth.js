const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/auth');
const { validate, asyncRoute, isAuth } = require('../middleware/common');
const email = () => body('email').isString().bail().trim().isEmail().withMessage('E-mail không hợp lệ.').bail().customSanitizer(value => value.toLowerCase());
// Không trim mật khẩu để bảo toàn đúng giá trị người dùng đã nhập.
const password = () => body('password').isString().bail().isLength({ min: 6, max: 72 }).withMessage('Mật khẩu cần từ 6 đến 72 ký tự.').custom(v => Buffer.byteLength(v, 'utf8') <= 72).withMessage('Mật khẩu không được vượt quá 72 byte.');
router.put('/signup', email(), body('name').isString().bail().trim().isLength({ min: 2, max: 80 }).withMessage('Tên cần từ 2 đến 80 ký tự.'), password(), validate, asyncRoute(controller.signup));
router.post('/login', email(), password(), validate, asyncRoute(controller.login));
router.get('/me', isAuth, asyncRoute(controller.me));
router.patch('/status', isAuth, body('status').isString().bail().trim().isLength({ min: 1, max: 140 }).withMessage('Trạng thái cần từ 1 đến 140 ký tự.'), validate, asyncRoute(controller.status));
module.exports = router;
