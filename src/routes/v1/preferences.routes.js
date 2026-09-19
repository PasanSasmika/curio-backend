import express from "express";

import {
  getPreferences,
  updatePreferences,
} from "../../controllers/preferences.controller.js";

const router = express.Router();

router.get("/", getPreferences);
router.put("/", updatePreferences);

export default router;