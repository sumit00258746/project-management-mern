import { useEffect, useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth, useOrganization, useOrganizationList } from "@clerk/react"
import toast from "react-hot-toast";
import api from "../configs/api";
import { fetchWorkspaces } from "../features/workspaceSlice";


const InviteMemberDialog = ({ isDialogOpen, setIsDialogOpen }) => {
    const { organization, isLoaded: isOrganizationLoaded } = useOrganization();
    const { setActive, isLoaded: isOrganizationListLoaded } = useOrganizationList();
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAligningWorkspace, setIsAligningWorkspace] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        role: "org:member",
    });

    useEffect(() => {
        if (!isDialogOpen || !currentWorkspace?.id || !isOrganizationListLoaded) {
            return;
        }

        if (organization?.id === currentWorkspace.id) {
            return;
        }

        let isCancelled = false;
        const alignActiveOrganization = async () => {
            setIsAligningWorkspace(true);
            console.debug("[invite:phase-0-align-active-org:start]", {
                selectedWorkspaceId: currentWorkspace.id,
                activeOrganizationId: organization?.id,
            });

            try {
                await setActive({ organization: currentWorkspace.id });
                console.debug("[invite:phase-0-align-active-org:success]", {
                    selectedWorkspaceId: currentWorkspace.id,
                });
            } catch (err) {
                console.error("[invite:phase-0-align-active-org:error]", err);
                toast.error(err.message || "Unable to select this workspace in Clerk");
            } finally {
                if (!isCancelled) {
                    setIsAligningWorkspace(false);
                }
            }
        };

        alignActiveOrganization();

        return () => {
            isCancelled = true;
        };
    }, [currentWorkspace?.id, isDialogOpen, isOrganizationListLoaded, organization?.id, setActive]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const email = formData.email.trim().toLowerCase();

            console.debug("[invite:phase-1-click]", {
                email,
                role: formData.role,
                selectedWorkspaceId: currentWorkspace?.id,
                activeOrganizationId: organization?.id,
            });

            if (!currentWorkspace?.id) {
                throw new Error("No workspace selected");
            }

            if (!isOrganizationLoaded || !organization?.id) {
                throw new Error("Clerk organization is still loading");
            }

            if (organization.id !== currentWorkspace.id) {
                throw new Error("Selected workspace and active Clerk organization are not synced yet");
            }

            try {
                const invitation = await organization.inviteMember({ emailAddress: email, role: formData.role })
                console.debug("[invite:phase-2-clerk-invitation-created]", {
                    invitationId: invitation?.id,
                    invitationStatus: invitation?.status,
                    organizationId: organization.id,
                    email,
                });
            } catch (inviteErr) {
                const inviteMessage = inviteErr?.errors?.[0]?.longMessage || inviteErr?.errors?.[0]?.message || inviteErr.message || "";
                const canContinueWithLocalAdd =
                    inviteMessage.toLowerCase().includes("already") ||
                    inviteMessage.toLowerCase().includes("invitation");

                console.warn("[invite:phase-2-clerk-invitation-not-created]", {
                    organizationId: organization.id,
                    email,
                    message: inviteMessage,
                    continuingToLocalAdd: canContinueWithLocalAdd,
                });

                if (!canContinueWithLocalAdd) {
                    throw inviteErr;
                }
            }

            try {
                const localRole = formData.role === "org:admin" ? "ADMIN" : "MEMBER";
                const { data: localMember } = await api.post(
                    "/api/workspaces/add-member",
                    {
                        workspaceId: currentWorkspace.id,
                        email,
                        role: localRole,
                    },
                    {
                        headers: { Authorization: `Bearer ${await getToken()}` },
                    }
                );

                console.debug("[invite:phase-3-local-workspace-member-created]", {
                    workspaceId: currentWorkspace.id,
                    userId: localMember?.userId,
                    role: localMember?.role,
                });

                await dispatch(fetchWorkspaces({ getToken })).unwrap();
                toast.success("Invitation sent and member added to workspace");
            } catch (localErr) {
                const status = localErr?.response?.status;
                const message = localErr?.response?.data?.error || localErr?.response?.data?.message || localErr.message;

                console.warn("[invite:phase-3-local-workspace-member-not-created]", {
                    workspaceId: currentWorkspace.id,
                    email,
                    status,
                    message,
                });

                if (status === 404) {
                    toast.success("Invitation sent. Member will be added after they create an account.");
                } else if (status === 400 && message === "User is already a member") {
                    await dispatch(fetchWorkspaces({ getToken })).unwrap();
                    toast.success("Invitation sent. User is already a workspace member.");
                } else {
                    throw localErr;
                }
            }
            setIsDialogOpen(false);
        } catch (err) {
            console.error("[invite:error]", err);
            toast.error(err.response?.data?.message || err.message || "Something went wrong");
        }
        finally {
            setIsSubmitting(false);
        }
    };

    if (!isDialogOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md text-zinc-900 dark:text-zinc-200">
                {/* Header */}
                <div className="mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserPlus className="size-5 text-zinc-900 dark:text-zinc-200" /> Invite Team Member
                    </h2>
                    {currentWorkspace && (
                        <p className="text-sm text-zinc-700 dark:text-zinc-400">
                            Inviting to workspace: <span className="text-blue-600 dark:text-blue-400">{currentWorkspace.name}</span>
                        </p>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 w-4 h-4" />
                            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Enter email address" className="pl-10 mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 text-sm placeholder-zinc-400 dark:placeholder-zinc-500 py-2 focus:outline-none focus:border-blue-500" required />
                        </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-200">Role</label>
                        <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 py-2 px-3 mt-1 focus:outline-none focus:border-blue-500 text-sm" >
                            <option value="org:member">Member</option>
                            <option value="org:admin">Admin</option>
                        </select>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setIsDialogOpen(false)} className="px-5 py-2 rounded text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" >
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting || isAligningWorkspace || !currentWorkspace || organization?.id !== currentWorkspace?.id} className="px-5 py-2 rounded text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-50 hover:opacity-90 transition" >
                            {isSubmitting ? "Sending..." : isAligningWorkspace ? "Selecting..." : "Send Invitation"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InviteMemberDialog;
