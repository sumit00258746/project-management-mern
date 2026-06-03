import { useState, useEffect, useMemo } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { Loader2Icon } from 'lucide-react'
import { useUser, SignIn, useAuth, CreateOrganization, useOrganizationList } from '@clerk/react'
import { fetchWorkspaces, syncClerkWorkspace } from '../features/workspaceSlice'

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { loading, workspaces } = useSelector((state) => state.workspace)
    const dispatch = useDispatch()
    const { user, isLoaded } = useUser()
    const userId = user?.id
    const userFullName = user?.fullName
    const userEmail = user?.primaryEmailAddress?.emailAddress
    const userImageUrl = user?.imageUrl
    const {
        isLoaded: isOrganizationListLoaded,
        userMemberships,
    } = useOrganizationList({
        userMemberships: true,
    })
    const clerkMemberships = useMemo(
        () => userMemberships.data || [],
        [userMemberships.data]
    )
    const clerkOrganizations = useMemo(
        () => clerkMemberships.map(({ organization }) => organization),
        [clerkMemberships]
    )
    const hasClerkOrganization = clerkOrganizations.length > 0
    // Initial load of theme
    const { getToken } = useAuth()
    useEffect(() => {
        dispatch(loadTheme())
    }, [dispatch])

    // initial load of user workspaces after the user has a Clerk organization
    useEffect(() => {
        if (isLoaded && userId && hasClerkOrganization) {
            console.debug("[workspace-sync:phase-1-fetch-workspaces:start]", {
                userId,
                clerkOrganizationIds: clerkOrganizations.map((organization) => organization.id),
            })
            dispatch(fetchWorkspaces({ getToken }))
        }
    }, [clerkOrganizations, dispatch, getToken, hasClerkOrganization, isLoaded, userId])

    useEffect(() => {
        if (!isLoaded || !userId || !hasClerkOrganization) {
            return
        }

        const syncedWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id))
        const missingOrganizations = clerkOrganizations.filter(
            (organization) => !syncedWorkspaceIds.has(organization.id)
        )

        console.debug("[workspace-sync:phase-2-compare-clerk-vs-db]", {
            userId,
            dbWorkspaceIds: [...syncedWorkspaceIds],
            clerkOrganizationIds: clerkOrganizations.map((organization) => organization.id),
            missingOrganizationIds: missingOrganizations.map((organization) => organization.id),
        })

        missingOrganizations.forEach((organization) => {
            const membership = clerkMemberships.find(
                (item) => item.organization.id === organization.id
            )

            console.debug("[workspace-sync:phase-3-sync-missing-workspace:start]", {
                userId,
                organizationId: organization.id,
                role: membership?.role,
            })

            dispatch(syncClerkWorkspace({
                getToken,
                organization,
                role: membership?.role,
                user: {
                    fullName: userFullName,
                    email: userEmail,
                    imageUrl: userImageUrl,
                },
            })).unwrap()
                .then((workspace) => {
                    console.debug("[workspace-sync:phase-4-sync-missing-workspace:success]", {
                        userId,
                        workspaceId: workspace?.id,
                        memberCount: workspace?.members?.length,
                    })
                })
                .catch((err) => {
                    console.error("[workspace-sync:phase-4-sync-missing-workspace:error]", {
                        userId,
                        organizationId: organization.id,
                        error: err?.response?.data || err?.message || err,
                    })
                })
        })
    }, [
        clerkOrganizations,
        clerkMemberships,
        dispatch,
        getToken,
        hasClerkOrganization,
        isLoaded,
        userEmail,
        userFullName,
        userId,
        userImageUrl,
        workspaces,
    ])

    if (!isLoaded) return (
        <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )
    if (!user) {
        return (
            <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <SignIn />
            </div>
        )
    }
    if (!isOrganizationListLoaded || userMemberships.isLoading) return (
        <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )

    if (!hasClerkOrganization) {
        return (
            <div className="min-h-screen flex justify-center items-center">
                <CreateOrganization afterCreateOrganizationUrl="/" />
            </div>
        )
    }

    if (loading || workspaces.length === 0) return (
        <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )
    return (
        <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col h-screen">
                <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}

export default Layout
