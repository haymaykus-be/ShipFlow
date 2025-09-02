# 🚚 ShipFlow – Multi-Carrier Dispatch & ETA Engine

ShipFlow is a logistics-focused **dispatch & tracking engine**.  
It ingests orders, assigns drivers intelligently, computes ETAs, and streams live updates to ops dashboards and customer tracking links.

---

## ✨ Features

- **Order Ingestion**
  - `POST /orders` with idempotent upserts
- **Driver Status Updates**
  - `POST /drivers/status` with location + capacity + state
- **Dispatch Engine**
  - `/dispatch/run` picks nearest available driver (capacity + window)
- **ETA Calculation**
  - Haversine distance + traffic buffer (Turf.js)
- **Tracking**
  - Socket.IO rooms per shipment (customer + ops board ready)
- **Event Logs (stretch)**
  - SLA breaches, webhook notifications, replayable event history

---

## 🏗️ Tech Stack

- **API**: [Fastify](https://www.fastify.io/) (Node.js)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Cache & Queues**: Redis + [BullMQ](https://docs.bullmq.io/)
- **Realtime**: Socket.IO
- **Geo**: Turf.js (distance, ETA, geofencing in stretch goals)
- **Observability**: OpenTelemetry-ready + Winston structured logging

---

## 📂 Project Structure

```txt
shipflow/
 ├── src/
 │   ├── app.ts              # Fastify setup
 │   ├── server.ts           # HTTP + Socket.IO bootstrap
 │   ├── config/             # DB, Redis, Logger
 │   ├── middleware/         # Error handling
 │   ├── modules/            # Routes (orders, drivers, dispatch)
 │   ├── services/           # Business logic (dispatch, geo, order)
 │   ├── jobs/               # BullMQ workers
 │   └── utils/              # Geo helpers, misc utils
 ├── prisma/schema.prisma    # Database schema
 ├── docker-compose.yml      # Postgres + Redis
 └── README.md
```

---

## ⚡ Quickstart

### 1. Clone & Install

```bash
git clone https://github.com/your-org/shipflow.git
cd shipflow
npm install
```

### 2. Run Database & Redis

```bash
docker-compose up -d
```

### 3. Migrate Schema

```bash
pnpx prisma migrate dev
```

### 4. Start Server

```bash
pnpm run dev
```

### 5. Seed Database

```bash
pnpm run prisma:seed
```

### 6. Run Migrations ( auto seeds after)

```bash
pnpm run prisma:migrate
```

Server runs on **http://localhost:3000**

---

## 🔑 Example API Calls

### Create Order

```http
POST /orders
Content-Type: application/json

{
  "pickup": { "lat": 40.7128, "lng": -74.0060 },
  "dropoff": { "lat": 40.73061, "lng": -73.935242 },
  "weight": 50,
  "windowStart": "2025-09-01T09:00:00Z",
  "windowEnd": "2025-09-01T12:00:00Z"
}
```

### Update Driver Status

```http
POST /drivers/status
Content-Type: application/json

{
  "id": "driver-123",
  "lat": 40.721,
  "lng": -73.988,
  "capacity": 200,
  "status": "available"
}
```

### Dispatch Order

```http
POST /dispatch/run
Content-Type: application/json

{ "orderId": "order-abc" }
```

---

## 🧩 Roadmap

- [x] Orders, Drivers, Dispatch MVP
- [x] ETA calculation (Haversine + buffer)
- [ ] Socket.IO tracking rooms for shipments
- [ ] SLA exceptions & webhook notifications
- [ ] BullMQ background jobs (dispatch / ETA recalculations)
- [ ] Geofencing & predictive ETAs (stretch)

---

## 🛡️ Best Practices

- Validation via [Zod](https://zod.dev/)
- Idempotency keys for `/orders`
- Structured logging with Winston
- Error handling middleware
- Redis for ephemeral state, Postgres for persistence
- Ready for scaling with BullMQ & Socket.IO adapters

---

## 📜 License

MIT © 2025 ShipFlow Contributors
