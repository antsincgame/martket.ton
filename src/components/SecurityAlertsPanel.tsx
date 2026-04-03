import type { FC } from 'react';
import { AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const iconBySeverity = {
  low: <CheckCircle className="w-5 h-5 text-green-400" />,
  medium: <Shield className="w-5 h-5 text-yellow-400" />,
  high: <AlertTriangle className="w-5 h-5 text-orange-400" />,
  critical: <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />,
};

const SecurityAlertsPanel: FC = () => {
  const { securityAlerts } = useAuth();

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
        <Shield className="mr-2 text-purple-400" /> Security Alerts
      </h3>
      <div className="space-y-2">
        {securityAlerts.length === 0 ? (
          <div className="p-6 text-center bg-white/5 rounded-xl border border-white/10">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-gray-400">Нет активных предупреждений</p>
          </div>
        ) : (
          securityAlerts.map((alert, index) => (
            <div key={index} className={`flex items-center p-3 rounded-xl border border-white/10 bg-white/5 ${alert.resolved ? 'opacity-60' : ''}`}>
              <div className="mr-3">{iconBySeverity[alert.severity]}</div>
              <div className="flex-1">
                <div className="font-semibold text-white">{alert.description}</div>
                <div className="text-xs text-gray-400">
                  {new Date(alert.timestamp).toLocaleString()} — Severity:{' '}
                  <span className={`font-bold ${
                    alert.severity === 'critical' ? 'text-red-400' :
                    alert.severity === 'high' ? 'text-orange-400' :
                    alert.severity === 'medium' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
              </div>
              {alert.resolved && (
                <span className="ml-2 px-2 py-1 text-xs rounded bg-green-500/20 text-green-300">Resolved</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SecurityAlertsPanel;
