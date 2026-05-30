import express from "express";
import { addComment, getTaskComments } from "../controllers/commentController.js";

const commentRouter = express.Router();
// Define your project routes here

commentRouter.post("/", addComment);
commentRouter.get("/:taskId", getTaskComments);

export default commentRouter;
