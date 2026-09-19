import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

// Security
app.use(helmet());

// CORS
app.use(cors());

// Request logging
app.use(morgan("dev"));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// API health check
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "WatchLater API is running",
    version: "v1"
  });
});

export default app;