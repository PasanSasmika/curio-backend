import express from "express";
import interestRoutes from "./interest.routes.js";
import contentRoutes from "./content.routes.js";
import savedRoutes from "./saved.routes.js";
import preferencesRoutes from "./preferences.routes.js";

const router = express.Router();

router.use("/interests", interestRoutes);
router.use("/content", contentRoutes);
router.use("/saved", savedRoutes);
router.use("/preferences", preferencesRoutes);

export default router;