import Image from "next/image";

interface GameImageProps {
  src: string;
  caption?: string;
  alt?: string;
}

export default function GameImage({ src, caption, alt }: GameImageProps) {
  return (
    <figure className="my-6 border border-border-hud overflow-hidden">
      <div className="relative w-full h-64">
        <Image
          src={src}
          alt={alt || caption || "Game screenshot"}
          fill
          className="object-contain bg-deep-lighter"
        />
      </div>
      {caption && (
        <figcaption className="px-3 py-2 font-mono text-xs text-text-muted border-t border-border-hud">
          // {caption}
        </figcaption>
      )}
    </figure>
  );
}
