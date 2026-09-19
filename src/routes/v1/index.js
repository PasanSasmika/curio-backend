import express from "express";
import interestRoutes from "./interest.routes.js";
import contentRoutes from "./content.routes.js";

const router = express.Router();

router.use("/interests", interestRoutes);
router.use("/content", contentRoutes);

export default router;