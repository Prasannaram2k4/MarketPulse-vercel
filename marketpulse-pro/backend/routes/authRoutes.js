// backend/routes/authRoutes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (normalizedUsername.length < 2 || normalizedUsername.length > 32) {
      return res.status(400).json({ message: 'Username must be between 2 and 32 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ message: 'Password must be between 6 and 128 characters.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = new User({ username: normalizedUsername, email: normalizedEmail, password });
    await user.save();

    return res.status(201).json({ message: 'Account created successfully.' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: 'Please check the submitted registration details.' });
    }
    const errorMessage = typeof error.message === 'string' ? error.message : '';
    if (
      error instanceof mongoose.Error.MongooseServerSelectionError
      || error.name === 'MongoNetworkError'
      || /buffering timed out|server selection timed out|ECONNREFUSED/i.test(errorMessage)
    ) {
      console.error('Registration database unavailable:', error);
      return res.status(503).json({
        message: 'Database unavailable. Check the MongoDB connection and network settings.',
      });
    }
    console.error('Registration failed:', error);
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured.');
      return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

export default router;