import express from "express";
import {
  getInterests,
  createInterest
} from "../../controllers/interest.controller.js";

const router = express.Router();

router.get("/", getInterests);
router.post("/", createInterest);

export default router;