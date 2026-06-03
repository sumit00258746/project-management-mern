import prisma from "../config/prisma.js";

export const createProject = async (req, res) => {
  // Logic to create a new project
  try {
    const { userId } = await req.auth();
    const {
      workspaceId,
      name,
      description,
      status,
      start_date,
      end_date,
      team_members,
      team_lead,
      progress,
      priority,
    } = req.body;

    // check if user has admin role for workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { include: { user: true } } },
    });
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    const isWorkspaceOwner = workspace.ownerId === userId;
    const isWorkspaceAdmin = workspace.members.some(
      (member) => member.userId === userId && member.role === "ADMIN",
    );
    if (
      !isWorkspaceOwner &&
      !isWorkspaceAdmin
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // get team lead using email
    const teamLead = await prisma.user.findUnique({
      where: { email: team_lead },
      select: { id: true },
    });
    if (!teamLead) {
      return res.status(404).json({ message: "Team lead not found" });
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name,
        description,
        status,
        priority,
        progress,
        team_lead: teamLead.id,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
      },
    });
    const membersToAdd = [];
    if (team_members?.length > 0) {
      workspace.members.forEach((member) => {
        if (team_members.includes(member.user.email)) {
          membersToAdd.push(member.user.id);
        }
      });
    }
    if (!membersToAdd.includes(teamLead.id)) {
      membersToAdd.push(teamLead.id);
    }
    if (membersToAdd.length > 0) {
      await prisma.projectMember.createMany({
        data: membersToAdd.map((userId) => ({
          projectId: project.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
    const projectWithMembers = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        tasks: {
          include: { assignee: true, comments: { include: { user: true } } },
        },
        owner: true,
      },
    });
    res.json({
      project: projectWithMembers,
      message: "Project created successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProject = async (req, res) => {
  // Logic to update an existing project
  try {
    const { userId } = await req.auth();
    const {
      id,
      workspaceId,
      name,
      description,
      status,
      start_date,
      end_date,
      progress,
      priority,
    } = req.body;

    // check admin has admin role or not
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { include: { user: true } } },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    const isWorkspaceOwner = workspace.ownerId === userId;
    const isWorkspaceAdmin = workspace.members.some(
      (member) => member.userId === userId && member.role === "ADMIN",
    );
    if (
      !isWorkspaceOwner &&
      !isWorkspaceAdmin
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (existingProject.workspaceId !== workspaceId) {
      return res.status(400).json({ message: "Project does not belong to this workspace" });
    }
    if (existingProject.team_lead !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        description,
        workspaceId,
        status,
        priority,
        progress,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
      },
    });
    res.json({ project, message: "Project updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const addMember = async (req, res) => {
  // Logic to add a member to a project
  try {
    const { userId } = await req.auth();
    const { projectId } = req.params;
    const { email } = req.body;

    // check is user is project lead

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { user: true } } },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.team_lead !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // check is user is already a member of the project
    const existingMember = project.members.find(
      (member) => member.email === email,
    );
    if (existingMember) {
      return res
        .status(400)
        .json({ message: "User is already a member of the project" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
      },
    });
    res.json({ member, message: "Member added successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};
