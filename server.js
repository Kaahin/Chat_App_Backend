// LOAD MODULE
// env
require("dotenv").config();
// express
const express = require("express");
// socket.IO
const { createServer } = require("http");
const { Server } = require("socket.io");
// mongodb
const { MongoClient } = require("mongodb");
// openai
const { Configuration, OpenAIApi } = require("openai");
// nanoid
const { v4: uuidv4 } = require("uuid");

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

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

console.log(process.env.OPENAI_API_KEY);

// BROADCASTING
httpServer.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
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
        avatar: "https://placeimg.com/140/140/any",
      },
    };
    console.log(msg);

    // Transmitt message to client
    io.emit("reply", msg);
  });
});
