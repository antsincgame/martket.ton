import React from 'react';
import { AlertTriangle, Shield, CheckCircle } from 'lucide-react';

export interface SecurityAlert {
  id: string;
  type: 'suspicious_location' | 'new_device' | 'multiple_sessions' | 'admin_action' | 'high_risk_operation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  resolved: boolean;
}

const mockAlerts: SecurityAlert[] = [
  {
    id: '1',
    type: 'high_risk_operation',
    severity: 'critical',
    description: 'Critical admin action detected',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    resolved: false
  },
  {
    id: '2',
    type: 'multiple_sessions',
    severity: 'high',
    description: 'Multiple concurrent sessions detected',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    resolved: false
  },
  {
    id: '3',
    type: 'suspicious_location',
    severity: 'medium',
    description: 'Login from unusual location',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    resolved: true
  }
];

const iconBySeverity = {
  low: <CheckCircle className="w-5 h-5 text-green-400" />,
  medium: <Shield className="w-5 h-5 text-yellow-400" />,
  high: <AlertTriangle className="w-5 h-5 text-orange-400" />,
  critical: <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
};

const SecurityAlertsPanel: React.FC = () => {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
        <Shield className="mr-2 text-purple-400" /> Security Alerts
      </h3>
      <div className="space-y-2">
        {mockAlerts.map(alert => (
          <div key={alert.id} className={`flex items-center p-3 rounded-xl border border-white/10 bg-white/5 ${alert.resolved ? 'opacity-60' : ''}`}>
            <div className="mr-3">{iconBySeverity[alert.severity]}</div>
            <div className="flex-1">
              <div className="font-semibold text-white">{alert.description}</div>
              <div className="text-xs text-gray-400">{new Date(alert.timestamp).toLocaleString()} • Severity: <span className={`font-bold ${alert.severity === 'critical' ? 'text-red-400' : alert.severity === 'high' ? 'text-orange-400' : alert.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}>{alert.severity.toUpperCase()}</span></div>
            </div>
            {alert.resolved && <span className="ml-2 px-2 py-1 text-xs rounded bg-green-500/20 text-green-300">Resolved</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SecurityAlertsPanel; 