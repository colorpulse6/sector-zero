import Link from "next/link";

interface CtaButtonProps {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}

export default function CtaButton({ href, children, external = false }: CtaButtonProps) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="cta-button">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="cta-button">
      {children}
    </Link>
  );
}
