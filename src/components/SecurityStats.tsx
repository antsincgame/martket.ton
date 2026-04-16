import React from 'react';
import { Shield, Users, Package, Activity, Loader2 } from 'lucide-react';
import { useAdminStats } from '../hooks/useAdminData';

const SecurityStats: React.FC = () => {
  const { data: stats, isLoading } = useAdminStats();

  const items = [
    { label: 'Users', value: stats?.demiurges ?? 0, icon: <Users className="w-6 h-6 text-blue-400" /> },
    { label: 'Products', value: stats?.products ?? 0, icon: <Package className="w-6 h-6 text-green-400" /> },
    { label: 'Published', value: stats?.publishedProducts ?? 0, icon: <Shield className="w-6 h-6 text-purple-400" /> },
    { label: 'Recent Activity', value: stats?.recentActivity ?? 0, icon: <Activity className="w-6 h-6 text-amber-400" /> },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
        <Shield className="mr-2 text-purple-400" /> Platform Stats
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((stat, i) => (
          <div key={i} className="bg-white/10 rounded-xl p-4 flex flex-col items-center justify-center">
            {stat.icon}
            {isLoading ? (
              <Loader2 className="w-6 h-6 mt-2 animate-spin text-gray-400" />
            ) : (
              <div className="text-2xl font-bold text-white mt-2">{stat.value}</div>
            )}
            <div className="text-gray-400 text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SecurityStats;
