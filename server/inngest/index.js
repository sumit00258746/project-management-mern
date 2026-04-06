import prisma from "../config/prisma.js";
import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });

const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: {
      event: "clerk/user.created",
    },
  },
  async ({ event }) => {
    console.log("Inngest clerk/user.created event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/user.created");
    }
    await prisma.user.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        name: `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim(),
        email: data?.email_addresses?.[0]?.email_address ?? "",
        image: data.image_url ?? "",
      },
      update: {
        name: `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim(),
        email: data?.email_addresses?.[0]?.email_address ?? "",
        image: data.image_url ?? "",
      },
    });
  },
);
const syncUserDeletion = inngest.createFunction(
  {
    id: "delete-user-from-clerk",
    triggers: {
      event: "clerk/user.deleted",
    },
  },
  async ({ event }) => {
    console.log("Inngest clerk/user.deleted event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/user.deleted");
    }
    await prisma.user.delete({
      where: {
        id: data.id,
      },
    });
  },
);
const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-from-clerk",
    triggers: {
      event: "clerk/user.updated",
    },
  },
  async ({ event }) => {
    console.log("Inngest clerk/user.updated event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/user.updated");
    }
    await prisma.user.update({
      where: {
        id: data.id,
      },
      data: {
        name: data?.first_name + " " + data?.last_name,
        email: data?.email_addresses[0]?.email_address,
        image: data.image_url,
      },
    });
  },
);

// to save workspace data to databse

const syncWorkspaceCreation = inngest.createFunction(
  {
    id: "sync-workspace-from-clerk",
    triggers: {
      event: "clerk/workspace.created",
    },
  },
  async ({ event }) => {
    console.log("Inngest clerk/workspace.created event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/workspace.created");
    }
    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data.image_url,
      },
    });
    // add creator as admin member

    await prisma.workspaceMember.create({
      data: {
        workspaceId: data.id,
        userId: data.created_by,
        role: "ADMIN",
      },
    });
  },
);

// to update workspace data to databse

const syncWorkspaceUpdation = inngest.createFunction(
  {
    id: "update-workspace-from-clerk",
    triggers: {
      event: "clerk/workspace.updated",
    },
  },
  async ({ event }) => {
    console.log("Inngest clerk/workspace.updated event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/workspace.updated");
    }
    await prisma.workspace.update({
      where: {
        id: data.id,
      },
      data: {
        name: data.name,
        slug: data.slug,
        image_url: data.image_url,
      },
    });
  },
);

// to delete  workspace data to databse
const syncWorkspaceDeletion = inngest.createFunction(
  {
    id: "delete-workspace-from-clerk",
    triggers: {
      event: "clerk/workspace.deleted",
    },
  },
  async ({ event }) => {
    console.log("Inngest clerk/workspace.deleted event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/workspace.deleted");
    }
    await prisma.workspace.delete({
      where: {
        id: data.id,
      },
    });
  },
);

// to save  workspace member data to a databse
const syncWorkspaceMemberCreation = inngest.createFunction(
  {
    id: "sync-workspace-member-from-clerk",
    triggers: {
      event: "clerk/organizatonInvitation.accepted  ",
    },
  },
  async ({ event }) => {
    console.log("Inngest clerk/organizatonInvitation.accepted event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error(
        "Missing event data for clerk/organizatonInvitation.accepted",
      );
    }
    await prisma.workspaceMember.create({
      data: {
        workspaceId: data.organization_id,
        userId: data.user_id,
        role: String(data.role_name).toUpperCase(),
      },
    });
  },
);

// Create an empty array where we'll export future Inngest functions
export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
];
