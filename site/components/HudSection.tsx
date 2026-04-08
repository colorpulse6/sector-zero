interface HudSectionProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export default function HudSection({ label, children, className = "" }: HudSectionProps) {
  return (
    <section className={`py-12 px-6 ${className}`}>
      <p className="hud-label mb-6">// {label}</p>
      {children}
    </section>
  );
}
