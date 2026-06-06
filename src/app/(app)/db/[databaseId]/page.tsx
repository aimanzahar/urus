import { notFound } from "next/navigation";
import { applyView, loadDatabaseBundle } from "@/lib/query";
import DatabaseWorkspace from "./DatabaseWorkspace";

export default async function DatabasePage({
  params,
  searchParams,
}: {
  params: Promise<{ databaseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { databaseId } = await params;
  const sp = await searchParams;
  const viewParam = typeof sp.view === "string" ? sp.view : undefined;

  const bundle = loadDatabaseBundle(databaseId);
  if (!bundle) notFound();

  const activeView =
    bundle.views.find((v) => v.id === viewParam) ?? bundle.views[0] ?? null;

  // Apply the view's filters to every view type; tables also apply sort.
  // Non-table views keep position order so they can derive their own layout.
  const displayRows = activeView
    ? applyView(
        bundle.rows,
        bundle.fields,
        activeView.type === "table"
          ? activeView.config
          : { filters: activeView.config.filters },
      )
    : bundle.rows;

  return (
    <DatabaseWorkspace
      database={bundle.database}
      fields={bundle.fields}
      views={bundle.views}
      rows={displayRows}
      activeView={activeView}
    />
  );
}
