interface ModeTagProps {
  children: React.ReactNode;
}

export default function ModeTag({ children }: ModeTagProps) {
  return (
    <span className="inline-block px-2 py-0.5 border border-purple-accent/30 text-purple-accent/80 font-mono text-[0.65rem] tracking-wider uppercase">
      {children}
    </span>
  );
}
