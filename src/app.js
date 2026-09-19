import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import v1Routes from "./routes/v1/index.js";

const app = express();

// Security
app.use(helmet());

// CORS
app.use(cors());

// Request logging
app.use(morgan("dev"));

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use("/api/v1", v1Routes);


// API health check
app.get("/api/v1/health", (req, res) => {
  const databaseStatus =
    mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected";

  res.status(200).json({
    success: true,
    message: "Curio API is running",
    version: "v1",
    database: databaseStatus
  });
});


export default app;