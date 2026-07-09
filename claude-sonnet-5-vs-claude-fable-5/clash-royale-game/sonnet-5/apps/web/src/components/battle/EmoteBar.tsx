import { EMOTE_IDS, type EmoteId } from "@arcane-towers/shared";

const EMOTE_GLYPH: Record<EmoteId, string> = {
  gg: "🤝",
  laugh: "😂",
  cry: "😭",
  angry: "😠",
  thanks: "🙏",
};

export function EmoteBar({ onEmote }: { onEmote: (emoteId: EmoteId) => void }) {
  return (
    <div className="flex gap-1">
      {EMOTE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onEmote(id)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-arcane-border bg-arcane-panel2/60 text-base transition-colors hover:bg-arcane-panel2"
        >
          {EMOTE_GLYPH[id]}
        </button>
      ))}
    </div>
  );
}
