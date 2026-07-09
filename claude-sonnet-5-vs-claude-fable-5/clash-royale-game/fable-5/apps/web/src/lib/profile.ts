"use client";

export interface GuestProfile {
  id: string;
  name: string;
}

const KEY = "arcane.profile";

const ADJECTIVES = ["Arcane", "Swift", "Grim", "Radiant", "Shadow", "Iron", "Ember", "Frost"];
const NOUNS = ["Knight", "Warden", "Seer", "Rider", "Titan", "Falcon", "Golem", "Blade"];

function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 90) + 10}`;
}

export function loadProfile(): GuestProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestProfile;
    if (typeof parsed?.id === "string" && typeof parsed?.name === "string") {
      return parsed;
    }
  } catch {
    // corrupted profile — regenerate below
  }
  return null;
}

export function saveProfile(profile: GuestProfile): void {
  window.localStorage.setItem(KEY, JSON.stringify(profile));
}

/** Get or lazily create the local guest profile, and register it server-side. */
export function ensureProfile(): GuestProfile {
  const existing = loadProfile();
  if (existing) return existing;
  const profile: GuestProfile = { id: crypto.randomUUID(), name: randomName() };
  saveProfile(profile);
  void syncProfile(profile);
  return profile;
}

/** Upsert the profile into Postgres (best effort — game works without it). */
export async function syncProfile(profile: GuestProfile): Promise<void> {
  try {
    await fetch("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
  } catch {
    // DB might be down; gameplay still works.
  }
}
