import express from "express";
import {
  getInterests,
  createInterest,
  searchInterests
} from "../../controllers/interest.controller.js";

const router = express.Router();

router.get("/", getInterests);
router.post("/", createInterest);
router.get("/search", searchInterests);

export default router;