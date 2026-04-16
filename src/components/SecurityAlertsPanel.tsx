import React from 'react';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuditLogs } from '../hooks/useAdminData';

const severityIcon: Record<string, React.ReactNode> = {
  success: <Shield className="w-5 h-5 text-green-400" />,
  failure: <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />,
};

const SecurityAlertsPanel: React.FC = () => {
  const { data: logs = [], isLoading } = useAuditLogs(20);

  const failures = logs.filter((l) => l.result !== 'success');

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading security alerts...
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
        <Shield className="mr-2 text-purple-400" /> Security Alerts
      </h3>
      {failures.length === 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-green-500/20 bg-green-500/5 text-green-300 text-sm">
          <Shield className="w-5 h-5" />
          No security incidents detected
        </div>
      ) : (
        <div className="space-y-2">
          {failures.map((log) => (
            <div key={log.id} className="flex items-center p-3 rounded-xl border border-white/10 bg-white/5">
              <div className="mr-3">{severityIcon[log.result] ?? severityIcon.failure}</div>
              <div className="flex-1">
                <div className="font-semibold text-white">
                  {log.action} on {log.resource}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(log.created_at).toLocaleString()}
                  {log.user_id && <> &middot; User: {log.user_id}</>}
                </div>
              </div>
              <span className="ml-2 px-2 py-1 text-xs rounded bg-red-500/20 text-red-300">
                {log.result}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecurityAlertsPanel;
