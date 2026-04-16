import React from 'react';
import { Clock, User, Loader2 } from 'lucide-react';
import { useAuditLogs } from '../hooks/useAdminData';

const colorByResult: Record<string, string> = {
  success: 'text-green-400',
  failure: 'text-red-400',
};

const SecurityEventsTable: React.FC = () => {
  const { data: logs = [], isLoading } = useAuditLogs(30);

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading security events...
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
        <Clock className="mr-2 text-purple-400" /> Security Events
      </h3>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-400">
              <th className="p-3 text-left">Action</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Time</th>
              <th className="p-3 text-left">Result</th>
              <th className="p-3 text-left">Resource</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  No events recorded
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/10 transition-colors">
                  <td className="p-3 font-mono">{log.action}</td>
                  <td className="p-3">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {log.user_id}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td className={`p-3 font-bold ${colorByResult[log.result] ?? 'text-yellow-400'}`}>
                    {log.result.toUpperCase()}
                  </td>
                  <td className="p-3">{log.resource}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SecurityEventsTable;
