"use client";

import { useRef } from "react";
import { updatePageAction } from "@/lib/actions";
import type { Page } from "@/lib/types";

export default function PageEditor({ page }: { page: Page }) {
  const formRef = useRef<HTMLFormElement>(null);

  const save = () => formRef.current?.requestSubmit();

  return (
    <form ref={formRef} action={updatePageAction} className="flex flex-col gap-2">
      <input type="hidden" name="pageId" value={page.id} />
      <input
        name="title"
        defaultValue={page.title}
        onBlur={save}
        placeholder="Untitled"
        aria-label="Page title"
        className="!border-0 !bg-transparent !px-0 !py-0 text-3xl font-bold tracking-tight !shadow-none focus:!shadow-none"
      />
      <textarea
        name="notes"
        defaultValue={page.notes ?? ""}
        onBlur={save}
        placeholder="Write notes about this part of the project…"
        rows={3}
        aria-label="Page notes"
        className="!border-0 !bg-transparent !px-0 !py-0 text-sm text-ink-soft resize-none !shadow-none focus:!shadow-none leading-relaxed"
      />
    </form>
  );
}
