import Link from "next/link";

const navLinks = [
  { href: "/news", label: "NEWS" },
  { href: "/about", label: "ABOUT" },
  { href: "/coming-soon", label: "COLONY" },
];

export default function Nav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-border-hud bg-deep-lighter/50">
      <Link
        href="/"
        className="font-mono text-sm font-bold tracking-[0.2em] text-cyan-accent"
      >
        SECTOR ZERO
      </Link>
      <div className="flex gap-6">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-mono text-xs tracking-wider text-text-muted hover:text-cyan-accent transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <a
          href="https://colorpulse6.github.io/knicks-knacks/sector-zero/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs tracking-wider text-cyan-accent hover:text-white transition-colors"
        >
          PLAY
        </a>
      </div>
    </nav>
  );
}
