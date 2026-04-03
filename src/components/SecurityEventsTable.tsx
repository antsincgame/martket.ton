import type { FC } from 'react';
import { Clock, User, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const colorBySeverity: Record<string, string> = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  critical: 'text-red-600 animate-pulse',
};

const SecurityEventsTable: FC = () => {
  const { securityEvents } = useAuth();

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
        <Clock className="mr-2 text-purple-400" /> Security Events
      </h3>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-x-auto">
        {securityEvents.length === 0 ? (
          <div className="p-6 text-center">
            <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-400">Нет событий безопасности</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-400">
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Severity</th>
              </tr>
            </thead>
            <tbody>
              {securityEvents.map((event) => (
                <tr key={event.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/10 transition-colors">
                  <td className="p-3 font-mono">{event.type}</td>
                  <td className="p-3 flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>{event.userId?.slice(0, 8) || '—'}</span>
                  </td>
                  <td className="p-3">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </td>
                  <td className={`p-3 font-bold ${colorBySeverity[event.severity] || 'text-gray-400'}`}>
                    {event.severity.toUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SecurityEventsTable;
