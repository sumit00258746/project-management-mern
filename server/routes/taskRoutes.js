import express from "express";
import {
  createTask,
  deleteTask,
  updateTask,
} from "../controllers/taskController.js";

const taskRouter = express.Router();

// Define your task routes here
taskRouter.post("/", createTask);
taskRouter.put("/:id", updateTask);
taskRouter.post("/delete", deleteTask);

export default taskRouter;
