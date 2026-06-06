import { nanoid } from "nanoid";

/**
 * Prefixed id helper. The 3-char prefix makes ids self-describing in the DB
 * and in JSON `properties` keys (e.g. `fld_…`), which is handy when eyeballing
 * rows. The prefix carries no logic — it's purely for humans.
 */
export type IdPrefix =
  | "pg"
  | "db"
  | "fld"
  | "opt"
  | "vw"
  | "row"
  | "rel";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${nanoid()}`;
}
