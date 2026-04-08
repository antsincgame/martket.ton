import React from 'react';
import { Clock, User } from 'lucide-react';

export interface SecurityEventRow {
  id: string;
  type: string;
  userId: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: string;
}

const mockEvents: SecurityEventRow[] = [
  {
    id: 'e1',
    type: 'login_attempt',
    userId: 'admin-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    severity: 'info',
    details: 'Successful login from known device'
  },
  {
    id: 'e2',
    type: 'permission_denied',
    userId: 'user-123',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    severity: 'warning',
    details: 'Attempted access to admin panel'
  },
  {
    id: 'e3',
    type: 'suspicious_activity',
    userId: 'mantra-admin',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    severity: 'error',
    details: 'Unusual login location detected'
  }
];

const colorBySeverity = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  critical: 'text-red-600 animate-pulse'
};

const SecurityEventsTable: React.FC = () => {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
        <Clock className="mr-2 text-purple-400" /> Security Events
      </h3>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-400">
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Time</th>
              <th className="p-3 text-left">Severity</th>
              <th className="p-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {mockEvents.map(event => (
              <tr key={event.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/10 transition-colors">
                <td className="p-3 font-mono">{event.type}</td>
                <td className="p-3 flex items-center space-x-2"><User className="w-4 h-4" /> <span>{event.userId}</span></td>
                <td className="p-3"><span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{new Date(event.timestamp).toLocaleString()}</span></td>
                <td className={`p-3 font-bold ${colorBySeverity[event.severity]}`}>{event.severity.toUpperCase()}</td>
                <td className="p-3">{event.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SecurityEventsTable; 