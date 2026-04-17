import type { FC } from 'react';
import { Users, Package, CheckCircle, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { useAdminStats } from '../../hooks/useAdminData';

interface StatCardProps {
  label: string;
  value: number;
  icon: FC<{ className?: string; style?: React.CSSProperties }>;
  accentColor: string;
}

const StatCard: FC<StatCardProps> = ({ label, value, icon: Icon, accentColor }) => (
  <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-5">
    <div className="flex items-center justify-between mb-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}15` }}
      >
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
      </div>
    </div>
    <div className="text-3xl font-bold text-white font-display">{value}</div>
    <div className="text-sm text-[#666666] mt-1">{label}</div>
  </div>
);

const AnalyticsDashboard: FC = () => {
  const { data: stats, isLoading, error, refetch } = useAdminStats();

  if (isLoading) {
    return (
      <div className="text-center p-12">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4 text-[#FFD700]" />
        <p className="text-[#999999]">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-12 rounded-xl border border-[#FF4444]/20 bg-[#FF4444]/5">
        <AlertCircle className="w-8 h-8 mx-auto mb-4 text-[#FF4444]" />
        <p className="text-[#FF4444] font-semibold">Failed to load analytics</p>
        <p className="text-[#999999] text-sm mb-4">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="border border-[#00F5FF]/30 text-[#00F5FF] px-4 py-2 rounded-lg hover:bg-[#00F5FF]/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const cards: StatCardProps[] = [
    { label: 'Total Demiurges', value: stats.demiurges, icon: Users, accentColor: '#00F5FF' },
    { label: 'Total Products', value: stats.products, icon: Package, accentColor: '#FFD700' },
    { label: 'Published', value: stats.publishedProducts, icon: CheckCircle, accentColor: '#00FF88' },
    { label: 'Recent Activity', value: stats.recentActivity, icon: Activity, accentColor: '#8B5CF6' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Analytics</h2>
        <button
          onClick={() => refetch()}
          className="border border-[#FFD700]/30 text-[#FFD700] px-4 py-2 rounded-lg hover:bg-[#FFD700]/10 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
