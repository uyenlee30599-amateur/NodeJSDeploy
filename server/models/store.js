const { MongoClient, ObjectId } = require('mongodb');

class MongoStore {
  constructor(db) { this.db = db; }
  async saveImage(name, contentType, data) { await this.db.collection('images').insertOne({ _id: name, contentType, data, createdAt: new Date() }); }
  async findImage(name) {
    const image = await this.db.collection('images').findOne({ _id: name });
    return image ? { ...image, data: Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data.buffer) } : null;
  }
  async deleteImage(name) { await this.db.collection('images').deleteOne({ _id: name }); }
  async init() { await this.db.collection('users').createIndex({ email: 1 }, { unique: true }); }
  async findUserByEmail(email) { return this.db.collection('users').findOne({ email }); }
  async findUser(id) { return this.db.collection('users').findOne({ _id: new ObjectId(id) }); }
  async createUser(user) { const { insertedId } = await this.db.collection('users').insertOne(user); return { ...user, _id: insertedId }; }
  async updateStatus(id, status) { await this.db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: { status } }); }
  async populateCreator(post) {
    if (!post) return null;
    const user = await this.findUser(String(post.creator._id));
    return { ...post, creator: { _id: String(post.creator._id), name: user?.name || post.creator.name } };
  }
  async listPosts() {
    const posts = await this.db.collection('posts').find().sort({ createdAt: -1, _id: -1 }).toArray();
    return Promise.all(posts.map(post => this.populateCreator(post)));
  }
  async findPost(id) { return this.populateCreator(await this.db.collection('posts').findOne({ _id: new ObjectId(id) })); }
  async createPost(post) { const { insertedId } = await this.db.collection('posts').insertOne(post); return { ...post, _id: insertedId }; }
  async updatePost(id, data) { await this.db.collection('posts').updateOne({ _id: new ObjectId(id) }, { $set: data }); return this.findPost(id); }
  async deletePost(id) { await this.db.collection('posts').deleteOne({ _id: new ObjectId(id) }); }
}
async function connectStore() {
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) throw new Error('Production cần MONGODB_URI của MongoDB Atlas.');
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const store = new MongoStore(client.db(process.env.MONGODB_DB || 'node-lab23'));
    await store.init();
    return { store, client };
  } catch (error) { await client.close(); throw error; }
}
module.exports = { MongoStore, connectStore };
