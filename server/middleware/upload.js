const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { fail } = require('./common');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, fieldSize: 20000 },
  fileFilter(_req, file, cb) {
    cb(['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype) ? null : fail(422, 'Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.'), true);
  }
}).single('image');
function imageExtension(file) {
  const b = file.buffer;
  if (file.mimetype === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
  if (file.mimetype === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255) return '.jpg';
  if (file.mimetype === 'image/webp' && b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP') return '.webp';
  throw fail(422, 'Nội dung file không khớp định dạng ảnh.');
}
async function saveImage(req) {
  const name = randomUUID() + imageExtension(req.file);
  if (req.app.locals.imageStorage === 'mongo') {
    await req.app.locals.store.saveImage(name, req.file.mimetype, req.file.buffer);
  } else {
    await fs.mkdir(req.app.locals.uploadDir, { recursive: true });
    await fs.writeFile(path.join(req.app.locals.uploadDir, name), req.file.buffer);
  }
  return `/images/${name}`;
}
async function removeImage(app, imageUrl) {
  if (!imageUrl || !/^\/images\/[a-f\d-]+\.(png|jpg|webp)$/.test(imageUrl)) return;
  try {
    if (app.locals.imageStorage === 'mongo') await app.locals.store.deleteImage(path.basename(imageUrl));
    else await fs.unlink(path.join(app.locals.uploadDir, path.basename(imageUrl)));
  }
  catch (error) { if (error.code !== 'ENOENT') console.error('Không thể xóa ảnh:', error.message); }
}
module.exports = { upload, saveImage, removeImage };
