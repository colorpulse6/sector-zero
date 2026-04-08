interface CalloutProps {
  children: React.ReactNode;
  label?: string;
}

export default function Callout({ children, label = "COMMANDER'S NOTE" }: CalloutProps) {
  return (
    <div className="my-6 border border-cyan-accent/20 bg-cyan-accent/5 px-4 py-3">
      <p className="font-mono text-[0.65rem] tracking-wider text-cyan-accent/60 mb-2">
        // {label}
      </p>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}
