"use strict";

const app = require("./app");
const env = require("./config/env");
const { connectDB } = require("./config/db");

(async () => {
  await connectDB();
  const server = app.listen(env.port, () => {
    console.log(`[server] voof-api listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
})();
