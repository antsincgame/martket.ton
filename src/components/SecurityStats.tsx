import React from 'react';
import { Shield, User, Lock, KeyRound } from 'lucide-react';

const SecurityStats: React.FC = () => {
  // Мок-статистика
  const stats = [
    { label: 'Active Sessions', value: 3, icon: <Shield className="w-6 h-6 text-blue-400" /> },
    { label: 'Blocked Users', value: 1, icon: <Lock className="w-6 h-6 text-red-400" /> },
    { label: 'MFA Enabled', value: 2, icon: <KeyRound className="w-6 h-6 text-green-400" /> },
    { label: 'Admins Online', value: 1, icon: <User className="w-6 h-6 text-purple-400" /> }
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
        <Shield className="mr-2 text-purple-400" /> Security Stats
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white/10 rounded-xl p-4 flex flex-col items-center justify-center">
            {stat.icon}
            <div className="text-2xl font-bold text-white mt-2">{stat.value}</div>
            <div className="text-gray-400 text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SecurityStats; 