import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';

const server = createServer(app);
const originalConnect = mongoose.connect;
const originalFindOne = User.findOne;
const originalSave = User.prototype.save;
const originalMongoUri = process.env.MONGO_URI;
let baseUrl;
let existingUser = false;
let saveError;
let lookupCount = 0;
let savedUser;

before(async () => {
  process.env.MONGO_URI = 'mongodb://test.invalid/marketpulse';
  mongoose.connect = async () => mongoose;
  User.findOne = async () => {
    lookupCount += 1;
    return existingUser ? { email: 'trader@example.com' } : null;
  };
  User.prototype.save = async function save() {
    if (saveError) {
      throw saveError;
    }
    savedUser = {
      username: this.username,
      email: this.email,
      password: this.password,
    };
  };

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api/auth/register`;
});

after(async () => {
  mongoose.connect = originalConnect;
  User.findOne = originalFindOne;
  User.prototype.save = originalSave;
  if (originalMongoUri === undefined) {
    delete process.env.MONGO_URI;
  } else {
    process.env.MONGO_URI = originalMongoUri;
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

async function register(payload) {
  return fetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

test('rejects invalid registration data before querying the database', async () => {
  const response = await register({
    username: 'T',
    email: 'not-an-email',
    password: 'short',
  });

  assert.equal(response.status, 400);
  assert.equal(lookupCount, 0);
});

test('reports missing MongoDB configuration as a service error', async () => {
  delete process.env.MONGO_URI;
  const response = await register({
    username: 'Market Trader',
    email: 'trader@example.com',
    password: 'secure123',
  });

  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /Configure MONGO_URI/);
  process.env.MONGO_URI = 'mongodb://test.invalid/marketpulse';
});

test('creates an account with a normalized email and username', async () => {
  const response = await register({
    username: '  Market Trader ',
    email: ' Trader@Example.com ',
    password: 'secure123',
  });

  assert.equal(response.status, 201);
  assert.deepEqual(savedUser, {
    username: 'Market Trader',
    email: 'trader@example.com',
    password: 'secure123',
  });
});

test('returns a conflict when the email is already registered', async () => {
  existingUser = true;
  const response = await register({
    username: 'Market Trader',
    email: 'trader@example.com',
    password: 'secure123',
  });

  assert.equal(response.status, 409);
  existingUser = false;
});

test('handles duplicate email races and reports service failures safely', async () => {
  saveError = { code: 11000 };
  const duplicateResponse = await register({
    username: 'Market Trader',
    email: 'trader@example.com',
    password: 'secure123',
  });
  assert.equal(duplicateResponse.status, 409);

  saveError = new Error('Operation users.findOne() buffering timed out after 10000ms');
  const databaseResponse = await register({
    username: 'Market Trader',
    email: 'trader@example.com',
    password: 'secure123',
  });
  assert.equal(databaseResponse.status, 503);
  assert.match((await databaseResponse.json()).message, /MongoDB connection and network settings/);

  saveError = new Error('database details should not be returned');
  const failedResponse = await register({
    username: 'Market Trader',
    email: 'trader@example.com',
    password: 'secure123',
  });
  assert.equal(failedResponse.status, 500);
  assert.deepEqual(await failedResponse.json(), {
    message: 'Registration failed. Please try again.',
  });
  saveError = undefined;
});

test('hashes passwords in the user pre-save hook', async () => {
  const user = new User({
    username: 'Market Trader',
    email: 'trader@example.com',
    password: 'secure123',
  });

  await new Promise((resolve, reject) => {
    User.schema.s.hooks.execPre('save', user, [], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  assert.notEqual(user.password, 'secure123');
  assert.equal(await bcrypt.compare('secure123', user.password), true);
});
