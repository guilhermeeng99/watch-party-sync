import { createServer } from "node:http";
import { readEnv } from "./config/env.js";
import { createSocketServer } from "./transport/socket-server.js";

const env = readEnv();

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: false, code: "not_found" }));
});

createSocketServer(httpServer, env);

httpServer.listen(env.PORT, () => {
  console.log(`Watch Party Sync server listening on http://localhost:${env.PORT}`);
});
