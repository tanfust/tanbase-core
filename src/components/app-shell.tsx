import { useState } from "react"
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import {
  CheckSquare2Icon,
  EllipsisVerticalIcon,
  FolderKanbanIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react"

import { BrandLockup } from "@/components/brand-lockup"
import { ThemeMenu } from "@/components/theme-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { authClient } from "@/modules/auth/client"
import type { ProjectView } from "@/modules/tasks/contracts"

interface AppShellProps {
  projects: ProjectView[]
  user: { name: string; email: string }
}

function initials(name: string, email: string) {
  const source = name.trim() || email
  return source
    .split(/\s+|@/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("")
}

export function AppShell({ projects, user }: AppShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const activeProjectId = new URLSearchParams(location.searchStr).get("project")
  const pageTitle = location.pathname === "/settings" ? "Settings" : "Board"

  async function signOut() {
    setSigningOut(true)
    const result = await authClient.signOut()
    setSigningOut(false)
    if (result.error) {
      toast.add({
        type: "error",
        title: "Could not sign out",
        description: result.error.message,
      })
      return
    }
    await router.invalidate()
    await navigate({ to: "/login" })
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link to="/app" search={{}} />}
              >
                <BrandLockup compact />
                <span className="font-heading font-semibold">TanBase Core</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location.pathname === "/app" && !activeProjectId}
                    tooltip="Board"
                    render={<Link to="/app" search={{}} />}
                  >
                    <FolderKanbanIcon />
                    <span>Board</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location.pathname === "/settings"}
                    tooltip="Settings"
                    render={<Link to="/settings" />}
                  >
                    <SettingsIcon />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {projects.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Projects</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projects.map((project) => (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        isActive={activeProjectId === project.id}
                        tooltip={project.name}
                        render={
                          <Link to="/app" search={{ project: project.id }} />
                        }
                      >
                        <CheckSquare2Icon />
                        <span>{project.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                  <Avatar className="size-8 rounded-2xl">
                    <AvatarFallback className="rounded-2xl">
                      {initials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                  <EllipsisVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="end"
                  className="min-w-56"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link to="/settings" />}>
                      <SettingsIcon />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={signOut} disabled={signingOut}>
                      {signingOut ? <Spinner /> : <LogOutIcon />}
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ms-auto">
            <ThemeMenu />
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 sm:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
