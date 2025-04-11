import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const registerUser = async (req, res) => {
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    
    // Check existing user
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ message: 'User already exists' }); // 409 Conflict
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 12); // Increased salt rounds
    const newUser = new User({ 
      name, 
      email, 
      password: hashedPassword,
      xp: 0,
      level: 1
    });

    await newUser.save();

    // Generate token
    const token = jwt.sign(
      { id: newUser._id, name, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Omit password in response
    const userResponse = {
      id: newUser._id,
      name,
      email,
      xp: newUser.xp,
      level: newUser.level
    };

    res.status(201).json({ 
      message: 'User registered successfully', 
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ 
      message: 'Registration failed',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' }); // Generic message for security
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Omit password in response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      xp: user.xp,
      level: user.level
    };

    res.json({ 
      message: 'Login successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ 
      message: 'Login failed',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// Validation middleware
export const validateAuth = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage('Password must contain uppercase, lowercase, and number')
];
