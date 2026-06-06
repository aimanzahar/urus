"use client";

// Anonymous per-browser identity for presence (no user accounts). Name + color
// persist in localStorage and are editable; the session id is per-tab.

export interface Identity {
  name: string;
  color: string;
}

const KEY = "urus-identity";

const PALETTE = [
  "#5b5bd6",
  "#3da35d",
  "#d6743d",
  "#d64a3d",
  "#8a5ad6",
  "#d64a9b",
  "#3daab0",
  "#d6ad3d",
  "#4a86d6",
];

const ADJ = [
  "Swift", "Calm", "Bright", "Bold", "Keen", "Brave", "Lucky", "Sunny",
  "Witty", "Cosmic", "Mellow", "Nimble",
];
const ANIMALS = [
  "Otter", "Falcon", "Tiger", "Panda", "Koala", "Hawk", "Fox", "Wolf",
  "Lynx", "Heron", "Gecko", "Moth",
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function getIdentity(): Identity {
  if (typeof window === "undefined") return { name: "Someone", color: PALETTE[0] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const id = JSON.parse(raw) as Identity;
      if (id?.name && id?.color) return id;
    }
  } catch {
    /* ignore */
  }
  const id: Identity = { name: `${pick(ADJ)} ${pick(ANIMALS)}`, color: pick(PALETTE) };
  try {
    localStorage.setItem(KEY, JSON.stringify(id));
  } catch {
    /* ignore */
  }
  return id;
}

export function setIdentityName(name: string): Identity {
  const cur = getIdentity();
  const next: Identity = { ...cur, name: name.trim().slice(0, 40) || cur.name };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

let _sid: string | null = null;
/** Per-tab session id (so two tabs of the same person are distinct viewers). */
export function getSessionId(): string {
  if (_sid) return _sid;
  _sid =
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  return _sid;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
