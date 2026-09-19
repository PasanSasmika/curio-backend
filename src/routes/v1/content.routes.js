import express from "express";
import { discoverContent, getContent, searchContent } from "../../controllers/content.controller.js";

const router = express.Router();


router.get("/", getContent);
router.get("/search", searchContent);
router.post("/discover", discoverContent);

export default router;