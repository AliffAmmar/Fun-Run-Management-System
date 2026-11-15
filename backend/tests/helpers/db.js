// In-memory MongoDB for tests: each test file gets its own throwaway database,
// so tests never touch your real run4fun data.
//
// Usage in a test file:
//   const db = require('./helpers/db');
//   beforeAll(db.connect); afterEach(db.clear); afterAll(db.close);
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function clear() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function close() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { connect, clear, close };
