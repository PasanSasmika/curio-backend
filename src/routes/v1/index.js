import express from "express";
import interestRoutes from "./interest.routes.js";

const router = express.Router();

router.use("/interests", interestRoutes);

export default router;