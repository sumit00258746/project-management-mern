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
    await prisma.user.create({
      data: {
        id: data.id,
        name: data?.first_name + " " + data?.last_name,
        email: data?.email_addresses[0]?.email_address,
        image: data.image_url,
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
// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdation];
