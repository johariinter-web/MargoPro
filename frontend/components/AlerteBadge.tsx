interface AlerteBadgeProps {
  count: number;
  label?: string;
}

export default function AlerteBadge({ count, label }: AlerteBadgeProps) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 bg-orange-alert text-white text-sm font-bold px-3 py-1 rounded-full">
      ⚠️ {count} {label ?? (count === 1 ? 'alerte stock' : 'alertes stock')}
    </span>
  );
}
