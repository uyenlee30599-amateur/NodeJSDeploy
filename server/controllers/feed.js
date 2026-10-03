const { fail } = require('../middleware/common');
const { saveImage, removeImage } = require('../middleware/upload');
async function findPost(req, ownerOnly = false) {
  const post = await req.app.locals.store.findPost(req.params.id);
  if (!post) throw fail(404, 'Không tìm thấy bài viết.');
  if (ownerOnly && String(post.creator._id) !== req.userId) throw fail(403, 'Bạn chỉ có thể sửa hoặc xóa bài viết của mình.');
  return post;
}
exports.list = async (req, res) => {
  const posts = await req.app.locals.store.listPosts();
  res.json({ posts, totalItems: posts.length });
};
exports.get = async (req, res) => res.json({ post: await findPost(req) });
exports.create = async (req, res) => {
  if (!req.file) throw fail(422, 'Vui lòng chọn ảnh.');
  const user = await req.app.locals.store.findUser(req.userId);
  if (!user) throw fail(401, 'Tài khoản không còn tồn tại.');
  const imageUrl = await saveImage(req);
  try {
    const post = await req.app.locals.store.createPost({ title: req.body.title, content: req.body.content, imageUrl, creator: { _id: req.userId, name: user.name }, createdAt: new Date(), updatedAt: new Date() });
    req.app.locals.io?.emit('posts', { action: 'create', post });
    res.status(201).json({ message: 'Đã tạo bài viết.', post });
  } catch (error) { await removeImage(req.app, imageUrl); throw error; }
};
exports.update = async (req, res) => {
  const old = await findPost(req, true);
  const imageUrl = req.file ? await saveImage(req) : old.imageUrl;
  let post;
  try { post = await req.app.locals.store.updatePost(req.params.id, { title: req.body.title, content: req.body.content, imageUrl, updatedAt: new Date() }); }
  catch (error) { if (req.file) await removeImage(req.app, imageUrl); throw error; }
  if (req.file) await removeImage(req.app, old.imageUrl);
  req.app.locals.io?.emit('posts', { action: 'update', post });
  res.json({ message: 'Đã cập nhật bài viết.', post });
};
exports.delete = async (req, res) => {
  const post = await findPost(req, true);
  await req.app.locals.store.deletePost(req.params.id);
  await removeImage(req.app, post.imageUrl);
  req.app.locals.io?.emit('posts', { action: 'delete', post: req.params.id });
  res.json({ message: 'Đã xóa bài viết.' });
};
