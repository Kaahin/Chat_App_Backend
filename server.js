// LOAD MODULE
// dotenv
require("dotenv").config();
// express
const express = require("express");
// socket.IO
const { createServer } = require("http");
const { Server } = require("socket.io");
// mongodb
const { MongoClient } = require("mongodb");
// mongoose
const mongoose = require("mongoose");
// openai
const { Configuration, OpenAIApi } = require("openai");
// nanoid
const { v4: uuidv4 } = require("uuid");
// schema
const User = require("./model/User");
// bcryptjs
const bcrypt = require("bcryptjs");
// jsonwebtoken
const jwt = require("jsonwebtoken"); // importerar jsonwebtoken
const req = require("express/lib/request");

// CREATE INSTANCES
// env
const PORT = process.env.PORT || 3 * process.env.PORT;
// express
const app = express();
// socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: `https://localhost:${PORT}`,
  },
});

// CONFIGURATION
const Key = process.env.OPENAI.toString();
const configuration = new Configuration({
  apiKey: Key,
});
// openai
const openai = new OpenAIApi(configuration);
// mongoose
mongoose.connect(
  process.env.DB_CONNECT,
  { useUnifiedTopology: true, UseNewUrlParser: true },
  () => {
    console.log("Connected to database!");
  }
);

// BROADCASTING
httpServer.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});

io.on("connection", (socket) => {
  console.log("new client connected");

  // Sign in request from client
  socket.on("signin", async ({ first, email, password }, reply) => {
    // Check if email exists in database
    const user = await User.findOne({ email });

    if (!user) {
      io.emit("signin-reply", { error: "Email is not found" });
    }

    // Check if password is correct
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      io.emit("signin-reply", { error: "Invalid password" });
    }

    // Create and assign token.
    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);

    io.emit("signin-reply", { "auth-token": token });
  });

  // Sign up request from client
  socket.on("signup", async ({ first, last, email, password }) => {
    console.log(first);
    // Check if user exists already
    const emailExist = await User.findOne({ email });

    if (emailExist) {
      io.emit("signup-reply", {
        error: ` User with an email: ${email} already exists`,
      });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10); // Här skapar vi en algoritm för hur säker vår lösen ska vara
    const hashPassword = await bcrypt.hash(password, salt);

    // Create new user!
    const user = new User({
      first,
      last,
      email,
      hashPassword,
    });

    console.log(user);
    try {
      // Save user to database
      await user.save();
      console.log(user);
      // Jwt signing inorder get token
      const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);
      console.log(user._id);
      io.emit("signup-reply", { user: user._id, token });
    } catch (error) {
      io.emit("signup-reply", error);
    }
  });

  // Receives message from client
  socket.on("request", async ({ _id, createdAt, text, user }) => {
    console.log(_id, createdAt, text, user);

    // Text from incoming request message as input for GPT3
    const input = text;

    const response = await openai.createCompletion("text-davinci-001", {
      prompt: input,
      temperature: 0.9,
      max_tokens: 300,
      top_p: 1,
      frequency_penalty: 0.0,
      presence_penalty: 0.6,
    });

    // Text extracted from GPT3 response as output
    const output = response.data.choices[0].text;
    console.log(response.data.choices[0].text);

    // Message object constructed to be send as reply to client
    const msg = {
      _id: uuidv4(),
      createdAt: new Date(),
      text: output,
      user: {
        _id: "Openai",
        name: "GPT3",
        avatar: "https://placeimg.com/140/140/tech",
      },
    };
    console.log(msg);

    // Transmitt message to client
    io.emit("reply", msg);
  });
});
