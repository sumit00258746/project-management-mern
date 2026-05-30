import prisma from "../config/prisma.js";

const getClerkImageUrl = (organization) =>
  organization?.image_url || organization?.imageUrl || organization?.image || "";

const workspaceInclude = {
  members: { include: { user: true } },
  projects: {
    include: {
      tasks: {
        include: {
          assignee: true,
          comments: { include: { user: true } },
        },
      },
      members: { include: { user: true } },
    },
  },
  owner: true,
};

// get all workspaces for user
export const getUserWorkspaces = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: workspaceInclude,
    });
    res.json(workspaces);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    res.status(500).json({
      message: error.code || error.message || "Internal Server Error",
    });
  }
};

// sync current Clerk organization to local workspace table
export const syncClerkWorkspace = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { organization, user } = req.body;

    if (!organization?.id) {
      return res.status(400).json({ error: "Missing organization data" });
    }

    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        name: user?.fullName || user?.name || "User",
        email: user?.email || `${userId}@clerk.local`,
        image: user?.imageUrl || user?.image || "",
      },
      update: {
        name: user?.fullName || user?.name || "User",
        email: user?.email || `${userId}@clerk.local`,
        image: user?.imageUrl || user?.image || "",
      },
    });

    await prisma.workspace.upsert({
      where: { id: organization.id },
      create: {
        id: organization.id,
        name: organization.name || "Workspace",
        slug: organization.slug || organization.id,
        ownerId: userId,
        image_url: getClerkImageUrl(organization),
      },
      update: {
        name: organization.name || "Workspace",
        slug: organization.slug || organization.id,
        image_url: getClerkImageUrl(organization),
      },
    });

    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: organization.id,
        },
      },
      create: {
        userId,
        workspaceId: organization.id,
        role: "ADMIN",
      },
      update: {},
    });

    const workspace = await prisma.workspace.findUnique({
      where: { id: organization.id },
      include: workspaceInclude,
    });

    res.json(workspace);
  } catch (error) {
    console.error("Error syncing Clerk workspace:", error);
    res.status(500).json({
      message: error.code || error.message || "Internal Server Error",
    });
  }
};

// add member to workspace

export const addMember = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { workspaceId, email, role, message } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!workspaceId || !email || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["ADMIN", "MEMBER"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      include: { members: true },
    });
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }
    if (
      !workspace.members.find(
        (member) => member.userId === userId && member.role === "ADMIN",
      )
    ) {
      return res.status(401).json({ error: "Only admins can add members" });
    }
    const existingMember = workspace.members.find(
      (member) => member.userId === user.id,
    );
    if (existingMember) {
      return res.status(400).json({ error: "User is already a member" });
    }
    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role,
        message,
      },
    });
    res.json({ ...member, message: "Member added successfully" });
  } catch (error) {
    console.error("Error adding member:", error);
    res.status(500).json({
      message: error.code || error.message || "Internal Server Error",
    });
  }
};
