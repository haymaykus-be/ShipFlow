import { buildApp } from "./app";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

const app = buildApp();
const server = createServer(app.server);

const io = new SocketIOServer(server, {
  cors: { origin: "*" },
});

// tracking rooms
io.on("connection", (socket) => {
  socket.on("join_shipment", (shipmentId: string) => {
    socket.join(`shipment:${shipmentId}`);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🚀 ShipFlow running at http://localhost:${port}`);
});
