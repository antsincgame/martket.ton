import React from 'react';
import SecurityAlertsPanel from './SecurityAlertsPanel';
import SecurityEventsTable from './SecurityEventsTable';
import SecurityStats from './SecurityStats';

const SecurityMonitor: React.FC = () => {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <span className="mr-3">🛡️</span> Security Command Center
          </h2>
      <SecurityStats />
      <SecurityAlertsPanel />
      <SecurityEventsTable />
      <div className="flex space-x-4 mt-6">
        <button className="bg-blue-500/20 text-blue-300 px-6 py-3 rounded-lg font-semibold hover:bg-blue-500/30 transition-colors">Провести аудит</button>
        <button className="bg-red-500/20 text-red-300 px-6 py-3 rounded-lg font-semibold hover:bg-red-500/30 transition-colors">Очистить алерты</button>
      </div>
    </div>
  );
};

export default SecurityMonitor; 