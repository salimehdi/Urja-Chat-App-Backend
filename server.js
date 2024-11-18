const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const cors = require("cors");
const { authenticate } = require("./controllers/authController");
const socketIo = require("socket.io");
const cookieParser = require("cookie-parser");
const User = require("./models/userModel");
const Message = require("./models/messageModel");
const http = require("http");
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;
app.use(cookieParser());
app.use(bodyParser.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use("/api", authRoutes);

const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  socket.on("fromIdClose", async (fromId) => {
    try {
      const updatedUser = await User.findOneAndUpdate(
        { _id: fromId },
        {
          isOnline: false,
          onlineId: null,
        },
        { new: true }
      );

      if (!updatedUser) {
        console.error(`User with id ${fromId} not found. ${user}`);
        return;
      }

      console.log(`User ${fromId} is now offline`);
    } catch (error) {
      console.error("Error updating user online status:", error);
    }
  });

  socket.on("goOnline", async (fromId) => {
    socket.broadcast.emit("someOneCameOnline", fromId);
  });
  socket.on("goOffline", async (fromId) => {
    socket.broadcast.emit("someOneGotOffline", fromId);
  });
  socket.on("fromId", async (fromId, socketId) => {
    try {
      const updatedUser = await User.findOneAndUpdate(
        { _id: fromId },
        {
          isOnline: true,
          onlineId: socketId,
        },
        { new: true }
      );

      if (!updatedUser) {
        console.error(`User with id ${fromId} not found.`);
        return;
      }

      console.log(
        `User ${fromId} is now online with socket ID: ${updatedUser}`
      );
    } catch (error) {
      console.error("Error updating user online status:", error);
    }
  });

  socket.on("typing", async (fromId, toId) => {
    console.log("typing event", fromId, toId);
    io.to(toId).emit("emitTyping", {fromId});
  })
  socket.on("typingStop", async (fromId, toId) => {
    io.to(toId).emit("emitTypingStop", {fromId});
  })

  socket.on("startChat", async (fromId, toId, msg) => {
    try {
      console.log(`Start event: fromId: ${fromId}, toId: ${toId}, msg: ${msg}`);

      const newMessage = new Message({
        first: fromId,
        second: toId,
        messages: [{ sender: false, text: msg }],
      });

      const savedMessage = await newMessage.save();

      console.log("New chat created:", savedMessage);

      const chatCode = savedMessage._id;

      const fromUserUpdate = await User.findByIdAndUpdate(
        fromId,
        {
          $push: { chats: { receiver: toId, chatCode } },
        },
        { new: true }
      );

      const toUserUpdate = await User.findByIdAndUpdate(
        toId,
        {
          $push: { chats: { receiver: fromId, chatCode } },
        },
        { new: true }
      );

      const toUser = await User.findById(toId);
      if (toUser?.isOnline) {
        io.to(toUser.onlineId).emit("newMessage", { chatCode, fromId, msg });
      }
    } catch (error) {
      console.error("Error in startChat:", error);
      socket.emit("error", { message: "Failed to start chat.", error });
    }
  });

  socket.on("sendMessage", async (fromId, chatCode, toId, message) => {
    try {
      console.log(
        `Continue chat: chatCode: ${chatCode}, toId: ${toId}, message: ${message}`
      );

      const chat = await Message.findById(chatCode);

      if (!chat) {
        console.error(`Chat with chatCode ${chatCode} not found.`);
        socket.emit("error", { message: "Chat not found." });
        return;
      }

      const sender = toId === chat.second;

      const updatedChat = await Message.findByIdAndUpdate(
        chatCode,
        {
          $push: {
            messages: { sender, text: message },
          },
        },
        { new: true }
      );
      const toUser = await User.findOne({ _id: toId });
      console.log("toUser", toUser);
      if (toUser?.isOnline) {
        io.to(toUser.onlineId).emit("newMessage", {
          chatCode,
          fromId,
          message,
        });
      }
    } catch (error) {
      console.error("Error in continueChat:", error);
      socket.emit("error", { message: "Failed to continue chat.", error });
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

app.get("/", authenticate, async (req, res) => {
  res.send("Server is running");
});

app.get("/api/isloggedin", authenticate, async (req, res) => {
  res.json({
    isLoggedIn: true,
    server: server,
  });
});

app.get("/api/messages/:chatCode", authenticate, async (req, res) => {
  try {
    const { chatCode } = req.params;

    const message = await Message.findById(chatCode);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    console.log("message", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/chats/all", authenticate, async (req, res) => {
  try {
    let user = await User.find({ _id: req.user.id });
    let response = await User.find({ _id: { $ne: req.user.id } });
    console.log("response", response);
    res.json({
      data: response,
      userDetails: user,
    });
  } catch (err) {
    console.error("Failed to fetch users:", err.message);
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: err.message });
  }
});

app.post("/api/chats/start", async (req, res) => {
  const { userId } = req.user;
  const { receiverId, initialMessage } = req.body;

  try {
    const sender = await User.findById(userId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingChat = sender.chats.find((chat) =>
      chat.receiver.equals(receiverId)
    );
    if (existingChat) {
      return res.json({
        message: "Chat already exists",
        chatCode: existingChat.chatCode,
      });
    }

    const newMessage = new Message({
      chatCode: mongoose.Types.ObjectId().toString(),
      participants: [sender._id, receiver._id],
      messages: [{ sender: sender._id, message: initialMessage }],
    });
    await newMessage.save();

    sender.chats.push({
      receiver: receiver._id,
      chatCode: newMessage.chatCode,
    });
    receiver.chats.push({
      receiver: sender._id,
      chatCode: newMessage.chatCode,
    });
    await sender.save();
    await receiver.save();

    res.json({ message: "Chat started", chatCode: newMessage.chatCode });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to start chat", error: err.message });
  }
});
app.post("/api/messages/send", async (req, res) => {
  const { chatCode, message } = req.body;
  const { id } = req.user;

  try {
    const chat = await Message.findOne({ chatCode });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    chat.messages.push({ sender: userId, message });
    await chat.save();

    res.json({ message: "Message sent", chat });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to send message", error: err.message });
  }
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
