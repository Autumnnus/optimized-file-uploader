import cors from "cors";
import express from "express";
import { initializeMinio } from "./minio";
import apiRoutes from "./routes";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api", apiRoutes);

// Initialize MinIO and start server
const startServer = async () => {
  try {
    await initializeMinio();
  } catch (err) {
    console.error("Failed to initialize MinIO:", err);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

startServer();
