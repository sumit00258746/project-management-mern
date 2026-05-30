import express from "express";
import {
  addMember,
  getUserWorkspaces,
  syncClerkWorkspace,
} from "../controllers/workspaceController.js";

const workspaceRouter = express.Router();

workspaceRouter.get("/", getUserWorkspaces);
workspaceRouter.post("/sync-clerk", syncClerkWorkspace);
workspaceRouter.post("/add-member", addMember);

export default workspaceRouter;
