interface HudSectionProps {
  label: string;
  title?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export default function HudSection({
  label,
  title,
  id,
  children,
  className = "",
}: HudSectionProps) {
  return (
    <section
      id={id}
      aria-label={title || label}
      className={`content-section ${className}`}
    >
      <div className="page-grid">
        <p className="eyebrow">{label}</p>
        {title && <h2 className="section-title">{title}</h2>}
        {children}
      </div>
    </section>
  );
}
