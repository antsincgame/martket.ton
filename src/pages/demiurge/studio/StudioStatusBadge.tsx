import { memo } from 'react';

export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'suspended';

const STATUS_META: Record<ProductStatus, { label: string; color: string; bg: string; ring: string; description: string }> = {
  draft: {
    label: 'Draft',
    color: '#FFD700',
    bg: 'bg-[#FFD700]/10',
    ring: 'ring-[#FFD700]/25',
    description: 'Visible only to you. Submit for review when ready.',
  },
  pending_review: {
    label: 'Pending review',
    color: '#00F5FF',
    bg: 'bg-[#00F5FF]/10',
    ring: 'ring-[#00F5FF]/25',
    description: 'Submitted to moderators. Most reviews complete within 48 hours.',
  },
  published: {
    label: 'Published',
    color: '#00FF88',
    bg: 'bg-[#00FF88]/10',
    ring: 'ring-[#00FF88]/25',
    description: 'Live on the marketplace.',
  },
  suspended: {
    label: 'Suspended',
    color: '#FF4444',
    bg: 'bg-[#FF4444]/10',
    ring: 'ring-[#FF4444]/25',
    description: 'Removed from sale. Edit and resubmit, or contact support.',
  },
};

export function getStatusMeta(status: string) {
  if (status in STATUS_META) {
    return STATUS_META[status as ProductStatus];
  }
  return {
    label: status,
    color: '#888',
    bg: 'bg-white/5',
    ring: 'ring-white/10',
    description: '',
  };
}

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const StudioStatusBadge = memo(({ status, size = 'sm' }: StatusBadgeProps) => {
  const meta = getStatusMeta(status);
  const sizing =
    size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider ring-1 ${sizing} ${meta.bg} ${meta.ring}`}
      style={{ color: meta.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}80` }}
        aria-hidden
      />
      {meta.label}
    </span>
  );
});

StudioStatusBadge.displayName = 'StudioStatusBadge';

export default StudioStatusBadge;
