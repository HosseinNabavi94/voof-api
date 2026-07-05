"use strict";

const mongoose = require("mongoose");
const env = require("./env");

mongoose.set("strictQuery", true);

async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri);
    const { host, name } = mongoose.connection;
    console.log(`[db] connected to MongoDB (${host}/${name})`);
  } catch (err) {
    console.error("[db] connection error:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected");
  });
}

module.exports = { connectDB, mongoose };
