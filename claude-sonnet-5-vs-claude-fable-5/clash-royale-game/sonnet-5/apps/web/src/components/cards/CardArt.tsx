import type { CardShape } from "@arcane-towers/shared";
import { cn } from "@/lib/utils";

interface CardArtProps {
  shape: CardShape;
  primaryColor: string;
  secondaryColor: string;
  className?: string;
}

function ShapeIcon({ shape, fill }: { shape: CardShape; fill: string }) {
  const common = { fill, stroke: "rgba(0,0,0,0.35)", strokeWidth: 1.5 };
  switch (shape) {
    case "diamond":
      return <polygon points="32,8 54,32 32,56 10,32" {...common} />;
    case "triangle":
      return <polygon points="32,8 56,54 8,54" {...common} />;
    case "hexagon":
      return <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" {...common} />;
    case "dotCluster":
      return (
        <g fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth={1.5}>
          <circle cx="24" cy="24" r="9" />
          <circle cx="42" cy="24" r="9" />
          <circle cx="33" cy="43" r="9" />
        </g>
      );
    case "spire":
      return <polygon points="32,5 45,52 19,52" {...common} />;
    case "orb":
      return <circle cx="32" cy="32" r="22" {...common} />;
    case "bolt":
      return <polygon points="36,4 16,34 28,34 24,60 48,28 34,28" {...common} />;
    case "shield":
      return <path d="M32 6 L54 14 V32 C54 46 44 56 32 60 C20 56 10 46 10 32 V14 Z" {...common} />;
    case "blade":
      return <path d="M29 4 L36 4 L39 40 L32 60 L25 40 Z" {...common} />;
    case "colossus":
      return (
        <g fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth={1.5}>
          <rect x="18" y="9" width="28" height="27" rx="6" />
          <rect x="11" y="37" width="42" height="21" rx="4" />
        </g>
      );
    default:
      return <circle cx="32" cy="32" r="20" {...common} />;
  }
}

export function CardArt({ shape, primaryColor, secondaryColor, className }: CardArtProps) {
  const gradientId = `grad-${shape}-${primaryColor.replace("#", "")}`;

  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{
        background: `radial-gradient(circle at 30% 20%, ${primaryColor}40, transparent 65%), linear-gradient(160deg, ${secondaryColor}, #0b0f1f)`,
      }}
    >
      <svg viewBox="0 0 64 64" className="h-[68%] w-[68%] drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </radialGradient>
        </defs>
        <ShapeIcon shape={shape} fill={`url(#${gradientId})`} />
      </svg>
    </div>
  );
}
