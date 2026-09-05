export default function Footer() {
  return (
    <footer className="border-t border-border-hud px-6 py-6 text-center">
      <p className="font-mono text-xs text-text-muted tracking-wider">
        SECTOR ZERO  - Built with Next.js &amp; HTML5 Canvas
      </p>
      <p className="font-mono text-xs text-text-muted/50 mt-1 flex items-center justify-center gap-4">
        <a
          href="https://github.com/colorpulse6/sector-zero"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-cyan-accent transition-colors"
        >
          GitHub
        </a>
        <a
          href="https://nichalasbarnes.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:text-cyan-accent transition-colors"
        >
          {/* The shared maker's mark, the same one on every site this person
              builds. Sector Zero keeps its own favicon. */}
          <img
            src="/nb-mark.png"
            alt=""
            width={20}
            height={20}
            loading="lazy"
            className="h-5 w-5 shrink-0 rounded-full opacity-75"
          />
          Built by Nic Barnes
        </a>
      </p>
    </footer>
  );
}
