# Optimized File Uploader (Dual Mode PoC)

This Proof of Concept (PoC) demonstrates the performance difference between a traditional proxy-based upload and an optimized presigned URL upload using MinIO.

## Prerequisites

- **Docker** & **Docker Compose**
- **Node.js** (v18+)
- **npm**

## Quick Start

### 1. Start Infrastructure (MinIO)

Run the storage service first.

```bash
docker-compose up -d
```

MinIO Console will be available at [http://localhost:9001](http://localhost:9001) (User: `minioadmin`, Pass: `minioadmin`).

### 2. Start Backend Server

```bash
cd server
npm install
npm install -D ts-node typescript nodemon # If not already installed globally or locally
npx ts-node src/index.ts
```

Server runs on `http://localhost:3000`.

### 3. Start Frontend Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`.

## Architecture Modes

### Mode A: Traditional (Proxy)

- **Upload:** File -> Node.js (Buffer/Disk) -> MinIO
- **Download:** MinIO -> Node.js Stream -> Client
- **Pros:** Simpler security model (server handles everything).
- **Cons:** High Server CPU/RAM usage, Network Bottleneck.

### Mode B: Optimized (Presigned URLs)

- **Upload:** Client -> MinIO (Directly)
- **Download:** Client -> MinIO (Directly)
- **Pros:** Zero load on application server, faster speeds, resumable/parallel uploads possible.
- **Cons:** Requires managing temporary credentials (handled via Presigned URLs).
