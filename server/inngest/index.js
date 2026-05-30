import prisma from "../config/prisma.js";
import sendEmail from "../config/nodemailer.js";
import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });

const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: [{ event: "clerk/user.created" }],
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
    triggers: [{ event: "clerk/user.deleted" }],
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
    triggers: [{ event: "clerk/user.updated" }],
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
    triggers: [{ event: "clerk/organization.created" }],
  },
  async ({ event }) => {
    console.log("Inngest clerk/organization.created event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/organization.created");
    }
    await prisma.workspace.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        name: data.name,
        slug: data.slug || data.id,
        ownerId: data.created_by,
        image_url: data.image_url || "",
      },
      update: {
        name: data.name,
        slug: data.slug || data.id,
        image_url: data.image_url || "",
      },
    });
    // add creator as admin member

    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: data.created_by,
          workspaceId: data.id,
        },
      },
      create: {
        workspaceId: data.id,
        userId: data.created_by,
        role: "ADMIN",
      },
      update: {},
    });
  },
);

// to update workspace data to databse

const syncWorkspaceUpdation = inngest.createFunction(
  {
    id: "update-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.updated" }],
  },
  async ({ event }) => {
    console.log("Inngest clerk/organization.updated event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/organization.updated");
    }
    await prisma.workspace.update({
      where: {
        id: data.id,
      },
      data: {
        name: data.name,
        slug: data.slug || data.id,
        image_url: data.image_url || "",
      },
    });
  },
);

// to delete  workspace data to databse
const syncWorkspaceDeletion = inngest.createFunction(
  {
    id: "delete-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.deleted" }],
  },
  async ({ event }) => {
    console.log("Inngest clerk/organization.deleted event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error("Missing event data for clerk/organization.deleted");
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
    triggers: [{ event: "clerk/organization_invitation.accepted" }],
  },
  async ({ event }) => {
    console.log("Inngest clerk/organization_invitation.accepted event:", event);
    const payload = event?.data ?? event;
    const data = payload?.data ?? payload;
    if (!data || typeof data !== "object") {
      throw new Error(
        "Missing event data for clerk/organization_invitation.accepted",
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

// inngest function to send email on task creation
const sendTaskAssignmentEmail = inngest.createFunction(
  {
    id: "send-task-assignment-email",
    triggers: [{ event: "app/task.assigned" }],
  },
  async ({ event, step }) => {
    const { taskId, origin } = event.data;
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: { assignee: true, project: true },
    });
    await sendEmail({
      to: task.assignee.email,
      subject: `new task assignment in ${task.project.name}`,
      body: `
            <div style="max-width: 600px;">
                <h2>Hi ${task.assignee.name}, 👋</h2>

                <p style="font-size: 16px;">You've been assigned a new task:</p>

                <p style="
                    font-size: 18px;
                    font-weight: bold;
                    color: #007bff;
                    margin: 8px 0;
                ">
                    ${task.title}
                </p>

                <div style="
                    border: 1px solid #ddd;
                    padding: 12px 16px;
                    border-radius: 6px;
                    margin-bottom: 30px;
                ">
                    <p style="margin: 6px 0;">
                        <strong>Description:</strong> ${task.description}
                    </p>

                    <p style="margin: 6px 0;">
                        <strong>Due Date:</strong>
                        ${new Date(task.due_date).toLocaleDateString()}
                    </p>
                </div>

                <a
                    href="${origin}"
                    style="
                        background-color: #007bff;
                        padding: 12px 24px;
                        border-radius: 5px;
                        color: #fff;
                        font-weight: 600;
                        font-size: 16px;
                        text-decoration: none;
                        display: inline-block;
                    "
                >
                    View Task
                </a>

                <p style="
                    margin-top: 20px;
                    font-size: 14px;
                    color: #6c757d;
                ">
                    Please make sure to review and complete it before the due date.
                </p>
            </div>
            `,
    });
    if (
      new Date(task.due_date).toLocaleDateString() !==
      new Date().toLocaleDateString()
    ) {
      await step.sleepUntil("wait-for-the-due-date", new Date(task.due_date));
      await step.run("check-if-task-is-completed", async () => {
        const task = await prisma.task.findUnique({
          where: {
            id: taskId,
          },
          include: { assignee: true, project: true },
        });
        if (!task) return;
        if (task.status !== "DONE") {
          await step.run("send-task-reminder-mail", async () => {
            await sendEmail({
              to: task.assignee.email,
              subject: `task reminder for ${task.project.name}`,
              body: `
            <div style="max-width: 600px;">
                <h2>Hi ${task.assignee.name}, 👋</h2>

                <p style="font-size: 16px;">
                    You have a task due in ${task.project.name}:
                </p>

                <p style="
                    font-size: 18px;
                    font-weight: bold;
                    color: #007bff;
                    margin: 8px 0;
                ">
                    ${task.title}
                </p>

                <div style="
                    border: 1px solid #ddd;
                    padding: 12px 16px;
                    border-radius: 6px;
                    margin-bottom: 30px;
                ">
                    <p style="margin: 6px 0;">
                        <strong>Description:</strong> ${task.description}
                    </p>

                    <p style="margin: 6px 0;">
                        <strong>Due Date:</strong>
                        ${new Date(task.due_date).toLocaleDateString()}
                    </p>
                </div>

                <a
                    href="${origin}"
                    style="
                        background-color: #007bff;
                        padding: 12px 24px;
                        border-radius: 5px;
                        color: #fff;
                        font-weight: 600;
                        font-size: 16px;
                        text-decoration: none;
                    "
                >
                    View Task
                </a>

                <p style="
                    margin-top: 20px;
                    font-size: 14px;
                    color: #6c757d;
                ">
                    Please make sure to review and complete it before the due date.
                </p>
            </div>
            `,
            });
          });
        }
      });
    }
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
  sendTaskAssignmentEmail,
];
