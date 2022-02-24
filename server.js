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
// cors
const cors = require("cors");
const { REPL_MODE_SLOPPY } = require("repl");
// CREATE INSTANCES
// env
const PORT = process.env.PORT || 3 * process.env.PORT;
// express
const app = express();
// app.use(cors());
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

app.get("/signup", async (req, res) => {
  console.log(req.query);
  // if existing user
  const emailExist = await User.findOne({ email: req.query.email });

  if (emailExist) {
    return res.status(400).json({ error: "Email Already in Use" });
  }

  // Hash Password
  const salt = await bcrypt.genSalt(10); // Här skapar vi en algoritm för hur säker vår lösen ska vara
  const hashPassword = await bcrypt.hash(req.query.password, salt);

  // Create user!
  const user = new User({
    first: req.query.first,
    last: req.query.last,
    email: req.query.email,
    password: hashPassword,
  });

  try {
    const savedUser = await user.save(); // detta sparar User i databasen
    console.log(savedUser);
    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);
    res.json({ user: user._id, token }); // skickar detta information till frontend.
  } catch (error) {
    res.status(400).json(error);
  }
});

app.get("/signin", async (req, res) => {
  // if existing email
  const user = await User.findOne({ email: req.query.email });

  if (!user) {
    return res.status(400).json({ error: "Email is not found" });
  }

  // Password correct?
  const validPassword = await bcrypt.compare(req.query.password, user.password);

  if (!validPassword) {
    return res.status(400).json({ error: "Invalid password" });
  }

  // create and assign token.
  const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET); // skapar en token för att skicka till frontend
  res.header("auth-token", token).json({ token }); //Här
});

io.on("connection", (socket) => {
  console.log("new client connected");

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
