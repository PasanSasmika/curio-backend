import express from "express";

import {
  saveContent,
  getSavedContent,
  removeSavedContent,
  checkSavedContent,
} from "../../controllers/saved.controller.js";

const router = express.Router();

router.get("/", getSavedContent);

router.post("/", saveContent);

router.get("/:videoId/check", checkSavedContent);

router.delete("/:videoId", removeSavedContent);

export default router;