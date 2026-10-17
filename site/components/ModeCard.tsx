import Link from "next/link";
import Image from "next/image";
import type { GameMode } from "@/data/modes";
import { withBasePath } from "@/lib/basePath";

export default function ModeCard({ mode }: { mode: GameMode }) {
  return (
    <Link href={`/news/${mode.slug}/`} className="mode-card">
      <div className="mode-preview">
        <span className="preview-index" aria-hidden="true">
          {mode.tagline}
        </span>
        <Image
          src={withBasePath(mode.image)}
          alt={`${mode.name} gameplay: ${mode.imageDescription}`}
          fill
          sizes="(max-width: 600px) 90vw, (max-width: 960px) 44vw, 350px"
          className="gameplay-image"
        />
      </div>
      <div className="mode-copy">
        <h3>
          {mode.name}
          <span aria-hidden="true">↗</span>
        </h3>
        <p>{mode.description}</p>
      </div>
    </Link>
  );
}
