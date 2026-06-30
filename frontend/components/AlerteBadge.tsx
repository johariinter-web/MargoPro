interface AlerteBadgeProps {
  count: number;
  label?: string;
}

export default function AlerteBadge({ count, label }: AlerteBadgeProps) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 bg-orange-alert text-white text-sm font-bold px-3 py-1 rounded-full">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {count} {label ?? (count === 1 ? 'alerte stock' : 'alertes stock')}
    </span>
  );
}
