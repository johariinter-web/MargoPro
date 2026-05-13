interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

export default function StatCard({ label, value, icon, trend, subtitle }: StatCardProps) {
  const trendColor =
    trend === 'up' ? 'text-green-gain' :
    trend === 'down' ? 'text-red-loss' :
    'text-stone-600 dark:text-stone-400';

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-stone-100 dark:border-stone-700">
      {icon && <div className="text-3xl mb-2">{icon}</div>}
      <p className="text-sm text-stone-600 dark:text-stone-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${trendColor}`}>{value}</p>
      {subtitle && <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{subtitle}</p>}
    </div>
  );
}
