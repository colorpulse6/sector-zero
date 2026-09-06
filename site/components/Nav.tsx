"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/about/", label: "About" },
  { href: "/news/", label: "Updates" },
  { href: "/coming-soon/", label: "Colony" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <nav aria-label="Main navigation" className="site-nav page-grid">
        <Link href="/" className="wordmark" aria-label="Sector Zero home">
          <span>SECTOR</span>
          <span>ZERO</span>
        </Link>
        <div className="nav-links">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href.slice(0, -1) || pathname.startsWith(href)
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </div>
        <a
          href="https://colorpulse6.github.io/sector-zero/"
          className="cta-button nav-play"
        >
          Play now <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </header>
  );
}
