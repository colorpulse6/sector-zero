import Link from "next/link";
import Image from "next/image";
import type { GameMode } from "@/data/modes";

interface ModeCardProps {
  mode: GameMode;
}

export default function ModeCard({ mode }: ModeCardProps) {
  return (
    <Link href={`/news/${mode.slug}`} className="mode-card block">
      <div className="flex items-stretch">
        <div className="w-24 h-24 relative bg-gradient-to-br from-purple-accent/20 to-cyan-accent/10 flex-shrink-0">
          <Image
            src={mode.image}
            alt={mode.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-3 flex-1 min-w-0">
          <p className="font-mono text-[0.6rem] tracking-wider text-purple-accent/80">
            {mode.tagline}
          </p>
          <h3 className="font-mono text-sm text-cyan-accent mt-0.5 truncate">
            {mode.name}
          </h3>
          <p className="text-xs text-text-muted mt-1 line-clamp-2">
            {mode.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
