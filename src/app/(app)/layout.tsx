import { requireAuth } from "@/lib/auth";
import { listPages } from "@/lib/data/pages";
import { listDatabasesForPage } from "@/lib/data/databases";
import SuppressNativeContextMenu from "@/components/SuppressNativeContextMenu";
import RealtimeProvider from "@/components/realtime/RealtimeProvider";
import Sidebar, { type SidebarPage } from "./Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  const pages: SidebarPage[] = listPages().map((p) => ({
    id: p.id,
    title: p.title,
    icon: p.icon,
    databases: listDatabasesForPage(p.id).map((d) => ({
      id: d.id,
      title: d.title,
      icon: d.icon,
    })),
  }));

  return (
    <RealtimeProvider>
      <div className="flex h-dvh overflow-hidden">
        <SuppressNativeContextMenu />
        <Sidebar pages={pages} />
        <main className="flex-1 min-w-0 overflow-hidden bg-bg">{children}</main>
      </div>
    </RealtimeProvider>
  );
}
