import React, { useState } from 'react';
import { RefreshCw, Search, Shield } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import SecurityAlertsPanel from './SecurityAlertsPanel';
import SecurityEventsTable from './SecurityEventsTable';
import SecurityStats from './SecurityStats';

const SecurityMonitor: React.FC = () => {
  const qc = useQueryClient();
  const [auditing, setAuditing] = useState(false);

  const handleRunAudit = async (): Promise<void> => {
    setAuditing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['audit-logs'] }),
        qc.invalidateQueries({ queryKey: ['admin-stats'] }),
      ]);
    } finally {
      setAuditing(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Shield className="w-6 h-6 mr-3 text-[#8B5CF6]" />
          Security Command Center
        </h2>
        <button
          type="button"
          onClick={handleRunAudit}
          disabled={auditing}
          className="inline-flex items-center gap-2 border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#C4B5FD] px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          {auditing ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Auditing...</>
          ) : (
            <><Search className="w-4 h-4" /> Run audit</>
          )}
        </button>
      </div>
      <SecurityStats />
      <SecurityAlertsPanel />
      <SecurityEventsTable />
    </div>
  );
};

export default SecurityMonitor;
