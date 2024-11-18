const mongoose = require('mongoose');

// Define the message array schema
const messageArray = new mongoose.Schema({
  sender: { type: Boolean, default: false }, // false/0 = first, true/1 = second
  text: { type: String, default: "" },
  time: { 
    type: String, 
    default: function() { 
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-indexed
      const year = now.getFullYear();
      return `${hours}:${minutes} | ${day}-${month}-${year}`;
    }
  }
});

// Define the main message schema
const messageSchema = new mongoose.Schema({
  first: { type: String, required: true },
  second: { type: String, required: true },
  isTyping: { type: Boolean, default: false },
  messages: { type: [messageArray], default: [] } 
});

// Create the Message model
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
