import type { Field, Row } from "@/lib/types";

export interface ViewProps {
  databaseId: string;
  fields: Field[];
  rows: Row[];
  onOpenRow: (rowId: string) => void;
}

/** Client-side row title = the first text field's value, else "Untitled". */
export function clientRowTitle(row: Row, fields: Field[]): string {
  const textField = fields.find((f) => f.type === "text");
  const v = textField ? row.properties[textField.id] : null;
  return typeof v === "string" && v.trim() ? v : "Untitled";
}

// --- date helpers: all string-based to avoid UTC day-shift ----------------

export function parseYMD(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function isYMD(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Days since an epoch, computed from the Y-M-D parts (UTC, no local tz). */
export function ymdToOrdinal(s: string): number | null {
  const p = parseYMD(s);
  if (!p) return null;
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
}

export function ordinalToYMD(ord: number): string {
  const dt = new Date(ord * 86400000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayYMD(): string {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthLabel(year: number, month1: number): string {
  return `${MONTHS[month1 - 1]} ${year}`;
}

export function shortDate(s: string): string {
  const p = parseYMD(s);
  if (!p) return s;
  return `${MONTHS[p.m - 1].slice(0, 3)} ${p.d}`;
}

/**
 * Weeks (each 7 cells) covering the month, padded to full weeks starting on
 * Monday. Each cell is a YMD string. Cells outside the month are flagged.
 */
export function monthGrid(
  year: number,
  month1: number,
): { ymd: string; inMonth: boolean }[] {
  const firstOrd = Math.floor(Date.UTC(year, month1 - 1, 1) / 86400000);
  const firstDow = new Date(firstOrd * 86400000).getUTCDay(); // 0=Sun
  const mondayOffset = (firstDow + 6) % 7; // days back to Monday
  const start = firstOrd - mondayOffset;
  const cells: { ymd: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const ord = start + i;
    const ymd = ordinalToYMD(ord);
    const p = parseYMD(ymd)!;
    cells.push({ ymd, inMonth: p.m === month1 });
  }
  // Trim the trailing all-out-of-month week if present.
  while (cells.length > 35 && !cells.slice(35).some((c) => c.inMonth)) {
    cells.length = 35;
  }
  return cells;
}
