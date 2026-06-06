import { notFound } from "next/navigation";
import { getPage } from "@/lib/data/pages";
import {
  databaseStats,
  listDatabasesForPage,
} from "@/lib/data/databases";
import { createDatabaseAction } from "@/lib/actions";
import PageEditor from "./PageEditor";
import PageMenu from "./PageMenu";
import PageDatabases from "./PageDatabases";

export default async function PageView({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = getPage(pageId);
  if (!page) notFound();

  const databases = listDatabasesForPage(pageId).map((d) => ({
    ...d,
    stats: databaseStats(d.id),
  }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="flex-1 min-w-0">
            <PageEditor page={page} />
          </div>
          <PageMenu pageId={page.id} />
        </div>

        <div className="hairline my-6" />

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-soft">Databases</h2>
          <form action={createDatabaseAction}>
            <input type="hidden" name="pageId" value={page.id} />
            <button className="btn btn-ghost btn-sm">+ New database</button>
          </form>
        </div>

        <PageDatabases pageId={page.id} databases={databases} />
      </div>
    </div>
  );
}
