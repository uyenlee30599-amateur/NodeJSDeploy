const { ObjectId } = require('mongodb');
// Chỉ dùng trong test; ứng dụng thật luôn lưu bằng MongoStore.
class MemoryStore {
  users = new Map(); posts = new Map(); images = new Map();
  async saveImage(name, contentType, data) { this.images.set(name, { contentType, data: Buffer.from(data) }); }
  async findImage(name) { return this.images.get(name); }
  async deleteImage(name) { this.images.delete(name); }
  async findUserByEmail(email) { return [...this.users.values()].find(u => u.email === email); }
  async findUser(id) { return this.users.get(String(id)); }
  async createUser(user) { const result = { ...user, _id: new ObjectId().toString() }; this.users.set(result._id, result); return result; }
  async updateStatus(id, status) { this.users.get(id).status = status; }
  async listPosts() { return [...this.posts.values()].reverse(); }
  async findPost(id) { return this.posts.get(id); }
  async createPost(post) { const result = { ...post, _id: new ObjectId().toString() }; this.posts.set(result._id, result); return result; }
  async updatePost(id, data) { const result = { ...this.posts.get(id), ...data }; this.posts.set(id, result); return result; }
  async deletePost(id) { this.posts.delete(id); }
}
module.exports = { MemoryStore };
