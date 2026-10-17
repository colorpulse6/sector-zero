import Link from "next/link";

interface CtaButtonProps {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  secondary?: boolean;
}

export default function CtaButton({
  href,
  children,
  external = false,
  secondary = false,
}: CtaButtonProps) {
  const className = secondary ? "text-link" : "cta-button";
  const content = (
    <>
      {children}
      <span aria-hidden="true">{secondary ? "↗" : "→"}</span>
    </>
  );
  return external ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
