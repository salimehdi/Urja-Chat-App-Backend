const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const login = async (req, res) => {
  const { password, email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }    
    const token = jwt.sign(
      { id: user._id, name: user.name },
      JWT_SECRET
    );
    res.cookie('token', token, {
      httpOnly: true,
    });

    return res.json({ message: 'Login successful' });
  } catch (err) {
    return res.status(500).json({ message: 'Error during login', error: err.message });
  }
};

const register = async (req, res) => {
  const { name, password, email } = req.body;
  try {
    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10); 
    const newUser = new User({ name, password: hashedPassword, email });
    await newUser.save();
    const token = jwt.sign(
      { id: newUser._id, name: newUser.name },
      JWT_SECRET
    );
    
    res.status(201).json({
      message: 'User registered successfully'
    });
  } catch (err) {
    console.error('Error registering user', err.message);
    res.status(500).json({ message: 'Error registering user', error: err.message });
  }
}

const authenticate = async (req, res, next) => {
  // Get the token from cookies (token name should be 'token' or change it based on your setup)
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided in cookies' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach the userId from decoded token to req.user
    req.user = { id: decoded.id };

    // Optionally, you can check if the user exists in the database
    const user = await User.find({ _id: decoded.id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Continue to the next middleware or route handler
    next();
  } catch (err) {
    return res.status(400).json({ message: 'Invalid or expired token', error: err.message });
  }
};

module.exports = {
  login,
  authenticate,
  register
};
