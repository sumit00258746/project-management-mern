import express from "express";
import {
  addMember,
  createProject,
  updateProject,
} from "../controllers/projectController.js";

const projectRouter = express.Router();

// Define your project routes here
projectRouter.post("/", createProject);
projectRouter.put("/", updateProject);
projectRouter.post("/:projectId/addMember", addMember);

export default projectRouter;
