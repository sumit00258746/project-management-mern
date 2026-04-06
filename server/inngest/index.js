import { prisma } from "../config/prisma.js";
import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });

const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
  },
  {
    event: "clerk/user.created",
  },
  async ({ event }) => {
    const { data } = event.data;
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
    id: "sync-user-from-clerk",
  },
  {
    event: "clerk/user.deleted",
  },
  async ({ event }) => {
    const { data } = event.data;
    await prisma.user.delete({
      where: {
        id: data.id,
      },
    });
  },
);
const syncUserUpdation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
  },
  {
    event: "clerk/user.updated",
  },
  async ({ event }) => {
    const { data } = event.data;
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
