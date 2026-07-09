export interface Identity {
  playerId: string;
  username: string;
}

const STORAGE_KEY = "arcane-towers:identity";

const ADJECTIVES = ["Swift", "Shadow", "Ember", "Frost", "Storm", "Iron", "Arcane", "Crimson", "Silver", "Astral"];
const NOUNS = ["Knight", "Warden", "Rider", "Mage", "Titan", "Vanguard", "Sentinel", "Ranger", "Herald", "Reaver"];

function randomUsername(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${a}${n}${num}`;
}

export function loadOrCreateIdentity(forceFresh: boolean): Identity {
  if (!forceFresh) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Identity;
        if (parsed.playerId && parsed.username) return parsed;
      } catch {
        // fall through and regenerate below
      }
    }
  }

  const identity: Identity = {
    playerId: crypto.randomUUID(),
    username: randomUsername(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export function saveIdentity(identity: Identity): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}
