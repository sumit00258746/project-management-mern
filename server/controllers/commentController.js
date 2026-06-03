import prisma from "../config/prisma.js";

// add comment
export const addComment = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { taskId, content } = req.body;

    if (!taskId || !content?.trim()) {
      return res
        .status(400)
        .json({ message: "Task ID and comment content are required" });
    }

    // check if task exists and user is a project member
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: {
        members: { include: { user: true } },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const member = project.members.find((member) => member.userId === userId);
    if (!member) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId,
        content,
      },
      include: {
        user: true,
      },
    });
    res.json({ comment, message: "Comment added successfully" });
  } catch (error) {
    console.error("Comment creation error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// get comments for task

export const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { user: true },
    });
    res.json({ comments });
  } catch (error) {
    console.error("Fetch comments error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
