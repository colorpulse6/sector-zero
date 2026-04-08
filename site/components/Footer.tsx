export default function Footer() {
  return (
    <footer className="border-t border-border-hud px-6 py-6 text-center">
      <p className="font-mono text-xs text-text-muted tracking-wider">
        SECTOR ZERO  - Built with Next.js &amp; HTML5 Canvas
      </p>
      <p className="font-mono text-xs text-text-muted/50 mt-1">
        <a
          href="https://github.com/colorpulse6/knicks-knacks"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-cyan-accent transition-colors"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}
