import Link from "next/link";
import { withBasePath } from "@/lib/basePath";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-grid footer-grid">
        <div>
          <Link
            href="/"
            className="wordmark footer-wordmark"
            aria-label="Sector Zero home"
          >
            <span>SECTOR</span>
            <span>ZERO</span>
          </Link>
          <p>A signal from the edge of known space.</p>
        </div>
        <div className="footer-credits">
          <a
            href="https://github.com/colorpulse6/sector-zero"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore the source <span aria-hidden="true">↗</span>
          </a>
          <a
            href="https://nichalasbarnes.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="creator-link"
          >
            <img
              src={withBasePath("/nb-mark.png")}
              alt=""
              width={24}
              height={24}
              loading="lazy"
            />
            Built by Nic Barnes
          </a>
        </div>
      </div>
      <div className="page-grid footer-note">
        SECTOR ZERO <span>Built with Next.js &amp; HTML5 Canvas</span>
      </div>
    </footer>
  );
}
