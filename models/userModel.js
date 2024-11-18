// models/userModel.js
const mongoose = require('mongoose');

// Define the chat schema
const chatSchema = new mongoose.Schema({
  receiver: { type: String, required: true },
  chatCode: { type: String, required: true }
});

// Define the user schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  isOnline: { type: Boolean, default: false }, // Default
  onlineId: { type: String, default: null }, // Default
  chats: { type: [chatSchema], default: [] } // Default value is null
});

const User = mongoose.model('User', userSchema);

module.exports = User;