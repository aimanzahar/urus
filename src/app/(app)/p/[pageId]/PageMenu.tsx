"use client";

import { Menu, MenuItem } from "@/components/Menu";
import { deletePageAction } from "@/lib/actions";

export default function PageMenu({ pageId }: { pageId: string }) {
  const onDelete = () => {
    if (!confirm("Delete this page and all its databases? This cannot be undone."))
      return;
    const fd = new FormData();
    fd.set("pageId", pageId);
    void deletePageAction(fd);
  };

  return (
    <Menu
      align="right"
      width={200}
      button={
        <button className="icon-btn" aria-label="Page options">
          ⋯
        </button>
      }
    >
      <MenuItem danger onClick={onDelete}>
        🗑 Delete page
      </MenuItem>
    </Menu>
  );
}
