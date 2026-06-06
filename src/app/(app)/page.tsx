import { redirect } from "next/navigation";
import { listPages } from "@/lib/data/pages";
import { createPageAction } from "@/lib/actions";

export default function HomePage() {
  const pages = listPages();
  if (pages.length > 0) redirect(`/p/${pages[0].id}`);

  return (
    <div className="h-full grid place-items-center px-6">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent grid place-items-center text-xl mx-auto mb-4">
          ▦
        </div>
        <h1 className="text-lg font-semibold mb-1.5">
          Welcome to your workspace
        </h1>
        <p className="text-sm text-ink-soft mb-5 leading-relaxed">
          Pages organize your project. Inside a page you can add databases and
          view them as a table, board, calendar, timeline or gallery.
        </p>
        <form action={createPageAction}>
          <button className="btn btn-primary">Create your first page</button>
        </form>
      </div>
    </div>
  );
}
