import { clerkClient } from "@clerk/express";
import prisma from "../config/prisma.js";

const getClerkImageUrl = (organization) =>
  organization?.image_url || organization?.imageUrl || organization?.image || "";

const mapClerkRole = (role) => (role === "org:admin" ? "ADMIN" : "MEMBER");

const getClerkMembershipUser = (membership) =>
  membership?.publicUserData ||
  membership?.public_user_data ||
  membership?.publicUser ||
  {};

const getClerkMembershipUserId = (membership) =>
  membership?.userId ||
  membership?.user_id ||
  membership?.publicUserData?.userId ||
  membership?.publicUserData?.user_id ||
  membership?.public_user_data?.user_id;

const getClerkMembershipEmail = (membership) => {
  const publicUser = getClerkMembershipUser(membership);
  return (
    publicUser?.identifier ||
    publicUser?.emailAddress ||
    publicUser?.email_address ||
    membership?.emailAddress ||
    membership?.email_address ||
    ""
  );
};

const getClerkMembershipName = (membership, fallback) => {
  const publicUser = getClerkMembershipUser(membership);
  const firstName = publicUser?.firstName || publicUser?.first_name || "";
  const lastName = publicUser?.lastName || publicUser?.last_name || "";
  return `${firstName} ${lastName}`.trim() || fallback || "User";
};

const getClerkMembershipImage = (membership) => {
  const publicUser = getClerkMembershipUser(membership);
  return publicUser?.imageUrl || publicUser?.image_url || "";
};

const syncAcceptedClerkMembersForWorkspace = async (workspaceId) => {
 

  const membershipList =
    await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: workspaceId,
      limit: 100,
    });

  const memberships = membershipList?.data || [];
 

  const syncedMembers = [];

  for (const membership of memberships) {
    const userId = getClerkMembershipUserId(membership);
    const email = getClerkMembershipEmail(membership);

    if (!userId) {
      console.warn("[workspace-member-backfill:phase-3-skip-missing-user-id]", {
        workspaceId,
        membership,
      });
      continue;
    }

    const user = await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        name: getClerkMembershipName(membership, email),
        email: email || `${userId}@clerk.local`,
        image: getClerkMembershipImage(membership),
      },
      update: {
        name: getClerkMembershipName(membership, "") || undefined,
        email: email || undefined,
        image: getClerkMembershipImage(membership) || undefined,
      },
    });

    const workspaceMember = await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      create: {
        userId,
        workspaceId,
        role: mapClerkRole(membership.role),
      },
      update: {
        role: mapClerkRole(membership.role),
      },
    });

    syncedMembers.push(workspaceMember);
   
  }

  return syncedMembers;
};

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
    let workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: workspaceInclude,
    });

    const adminWorkspaceIds = workspaces
      .filter((workspace) =>
        workspace.members.some(
          (member) => member.userId === userId && member.role === "ADMIN",
        ),
      )
      .map((workspace) => workspace.id);

    for (const workspaceId of adminWorkspaceIds) {
      try {
        await syncAcceptedClerkMembersForWorkspace(workspaceId);
      } catch (error) {
        console.error("[workspace-member-backfill:error]", {
          workspaceId,
          error: error?.errors || error?.message || error,
        });
      }
    }

    if (adminWorkspaceIds.length > 0) {
      workspaces = await prisma.workspace.findMany({
        where: {
          members: {
            some: {
              userId: userId,
            },
          },
        },
        include: workspaceInclude,
      });
    }

    res.json(workspaces);
  } catch (error) {
    console.error("[workspace:phase-1-fetch:error]", error);
    res.status(500).json({
      message: error.code || error.message || "Internal Server Error",
    });
  }
};

// sync current Clerk organization to local workspace table
export const syncClerkWorkspace = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { organization, user, role } = req.body;


    if (!organization?.id) {
      return res.status(400).json({ error: "Missing organization data" });
    }

    const syncedUser = await prisma.user.upsert({
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
  

    const syncedWorkspace = await prisma.workspace.upsert({
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
   

    const memberRole = role ? mapClerkRole(role) : undefined;

    const syncedMember = await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: organization.id,
        },
      },
      create: {
        userId,
        workspaceId: organization.id,
        role:
          memberRole ||
          (organization.createdBy === userId || organization.created_by === userId
            ? "ADMIN"
            : "MEMBER"),
      },
      update: memberRole ? { role: memberRole } : {},
    });
  

    const workspace = await prisma.workspace.findUnique({
      where: { id: organization.id },
      include: workspaceInclude,
    });
   

    res.json(workspace);
  } catch (error) {
    console.error("[workspace-sync:error]", error);
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
      console.warn("[workspace-add-member:phase-2-user-lookup:not-found]", {
        email,
      });
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
      console.warn("[workspace-add-member:phase-3-workspace-lookup:not-found]", {
        workspaceId,
      });
      return res.status(404).json({ error: "Workspace not found" });
    }
  
    if (
      !workspace.members.find(
        (member) => member.userId === userId && member.role === "ADMIN",
      )
    ) {
      console.warn("[workspace-add-member:phase-4-admin-check:failed]", {
        requestedBy: userId,
        workspaceId,
      });
      return res.status(401).json({ error: "Only admins can add members" });
    }
    const existingMember = workspace.members.find(
      (member) => member.userId === user.id,
    );
    if (existingMember) {
      console.warn("[workspace-add-member:phase-5-existing-member:found]", {
        userId: user.id,
        workspaceId,
      });
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
    console.error("[workspace-add-member:error]", error);
    res.status(500).json({
      message: error.code || error.message || "Internal Server Error",
    });
  }
};
