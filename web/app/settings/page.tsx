import { Settings } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ComingSoon } from "@/components/coming-soon"

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Workspace and company preferences." />
      <ComingSoon
        icon={Settings}
        title="Settings workspace"
        description="Manage company profiles, team members, and workspace preferences. Access control is enforced by the backend."
      />
    </>
  )
}
