import express from "express";
import { discoverContent, getContent, getContentById, searchContent } from "../../controllers/content.controller.js";

const router = express.Router();


router.get("/", getContent);
router.get("/search", searchContent);
router.post("/discover", discoverContent);
router.get("/:id", getContentById);

export default router;