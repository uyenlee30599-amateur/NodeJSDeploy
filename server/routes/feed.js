const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/feed');
const { isAuth, validId, validate, asyncRoute } = require('../middleware/common');
const { upload } = require('../middleware/upload');
const fields = () => [
  body('title').isString().bail().trim().isLength({ min: 5, max: 120 }).withMessage('Tiêu đề cần từ 5 đến 120 ký tự.'),
  body('content').isString().bail().trim().isLength({ min: 5, max: 10000 }).withMessage('Nội dung cần từ 5 đến 10000 ký tự.')
];
router.use(isAuth);
router.get('/posts', asyncRoute(controller.list));
router.get('/posts/:id', validId, asyncRoute(controller.get));
router.post('/post', upload, fields(), validate, asyncRoute(controller.create));
router.put('/post/:id', validId, upload, fields(), validate, asyncRoute(controller.update));
router.delete('/post/:id', validId, asyncRoute(controller.delete));
module.exports = router;
