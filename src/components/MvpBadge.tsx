interface MvpBadgeProps {
  className?: string;
  label?: string;
}

export default function MvpBadge({ className = '', label = 'MVP Demo' }: MvpBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FFD700]/15 to-[#FFA500]/15 border border-[#FFD700]/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#FFD700] ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse" />
      {label}
    </span>
  );
}
