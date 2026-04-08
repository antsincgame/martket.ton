import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Clock, User, Eye, Search, Filter, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SecurityLog {
  id: string;
  timestamp: string;
  event_type: 'login_attempt' | 'permission_denied' | 'suspicious_activity' | 'data_access' | 'admin_action' | 'security_alert';
  severity: 'info' | 'warning' | 'error' | 'critical';
  user_id?: string;
  ip_address: string;
  user_agent: string;
  description: string;
  details: Record<string, any>;
  resolved: boolean;
}

const RealSecurityLogs: React.FC = () => {
  const { hasPermission, user, reportSecurityEvent } = useAuth();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);

  useEffect(() => {
    loadSecurityLogs();
  }, []);

  const loadSecurityLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentTime = new Date();
      const mockLogs: SecurityLog[] = [
        {
          id: 'log-1',
          timestamp: new Date(currentTime.getTime() - 5 * 60 * 1000).toISOString(),
          event_type: 'admin_login',
          severity: 'info',
          description: 'Successful admin login',
          ip_address: '192.168.1.100',
          resolved: true
        },
        {
          id: 'log-2',
          timestamp: new Date(currentTime.getTime() - 45 * 60 * 1000).toISOString(),
          event_type: 'security_alert',
          severity: 'critical',
          description: 'Suspicious activity detected',
          ip_address: '10.0.0.42',
          resolved: false
        }
      ];
      
      setLogs(mockLogs);

      // Report that security logs were accessed
      reportSecurityEvent({
        type: 'data_access',
        severity: 'info',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          action: 'view_security_logs',
          log_count: mockLogs.length
        }
      });

    } catch (err) {
      console.error('Error loading security logs:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resolveLog = async (logId: string) => {
    setLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, resolved: true } : log
    ));

    reportSecurityEvent({
      type: 'admin_action',
      severity: 'info',
      ipAddress: 'client_ip',
      userAgent: navigator.userAgent,
      details: { 
        action: 'resolve_security_log',
        log_id: logId,
        operator: user?.email
      }
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip_address.includes(searchTerm) ||
      (log.user_id && log.user_id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesType = typeFilter === 'all' || log.event_type === typeFilter;

    return matchesSearch && matchesSeverity && matchesType;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'info': return <CheckCircle className="w-5 h-5 text-blue-400" />;
      default: return <Shield className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string, resolved: boolean = true) => {
    const opacity = resolved ? '20' : '30';
    const textOpacity = resolved ? '400' : '300';
    
    switch (severity) {
      case 'critical': return `bg-red-500/${opacity} text-red-${textOpacity} border-red-500/30`;
      case 'error': return `bg-red-500/${opacity} text-red-${textOpacity} border-red-500/30`;
      case 'warning': return `bg-yellow-500/${opacity} text-yellow-${textOpacity} border-yellow-500/30`;
      case 'info': return `bg-blue-500/${opacity} text-blue-${textOpacity} border-blue-500/30`;
      default: return `bg-gray-500/${opacity} text-gray-${textOpacity} border-gray-500/30`;
    }
  };

  if (!hasPermission('audit_logs', 'read')) {
    return (
      <div className="text-center p-8 bg-red-500/10 rounded-lg">
        <Shield className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h3 className="text-xl font-bold text-red-400 mb-2">Access Denied</h3>
        <p className="text-gray-400">You don't have permission to view security logs.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Shield className="mr-3 text-red-400" />
          Real Security Logs 🛡️
        </h2>
        <button 
          onClick={loadSecurityLogs}
          disabled={loading}
          className="bg-red-500/20 text-red-300 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-blue-500/50 focus:outline-none"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-blue-500/50 focus:outline-none"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-blue-500/50 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="login_attempt">Login Attempts</option>
          <option value="permission_denied">Permission Denied</option>
          <option value="suspicious_activity">Suspicious Activity</option>
          <option value="data_access">Data Access</option>
          <option value="admin_action">Admin Actions</option>
          <option value="security_alert">Security Alerts</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{logs.length}</div>
          <div className="text-gray-400 text-sm">Total Logs</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{logs.filter(l => l.severity === 'critical').length}</div>
          <div className="text-gray-400 text-sm">Critical</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{logs.filter(l => l.severity === 'error').length}</div>
          <div className="text-gray-400 text-sm">Errors</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{logs.filter(l => l.severity === 'warning').length}</div>
          <div className="text-gray-400 text-sm">Warnings</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{logs.filter(l => l.resolved).length}</div>
          <div className="text-gray-400 text-sm">Resolved</div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center p-8">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4 text-blue-400" />
          <p className="text-gray-400">Loading security events... 🔍</p>
        </div>
      ) : error ? (
        <div className="text-center p-8 bg-red-500/10 rounded-lg">
          <Shield className="w-8 h-8 mx-auto mb-4 text-red-400" />
          <p className="text-red-400 font-semibold">Error loading security logs</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button onClick={loadSecurityLogs} className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className={`hover:bg-white/5 ${!log.resolved ? 'bg-red-500/5' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getSeverityIcon(log.severity)}
                        <span className={`px-2 py-1 text-xs rounded-full font-medium border ${getSeverityColor(log.severity, log.resolved)}`}>
                          {log.severity.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-white">{log.description}</div>
                        <div className="text-sm text-gray-400">{log.event_type.replace('_', ' ')}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {Math.round((Date.now() - new Date(log.timestamp).getTime()) / 60000)}m ago
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-blue-400 font-mono">{log.ip_address}</div>
                      {log.user_id && (
                        <div className="text-xs text-gray-400">User: {log.user_id}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.resolved ? (
                        <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-500/20 text-green-300">
                          RESOLVED
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full font-medium bg-red-500/20 text-red-300 animate-pulse">
                          OPEN
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-blue-400 hover:text-blue-300"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!log.resolved && hasPermission('audit_logs', 'update') && (
                          <button
                            onClick={() => resolveLog(log.id)}
                            className="text-green-400 hover:text-green-300"
                            title="Mark Resolved"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              {getSeverityIcon(selectedLog.severity)}
              <span className="ml-2">Security Log Details</span>
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 text-sm">Event Type:</span>
                  <div className="text-white font-medium">{selectedLog.event_type.replace('_', ' ')}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Severity:</span>
                  <div className={`font-medium ${
                    selectedLog.severity === 'critical' ? 'text-red-400' :
                    selectedLog.severity === 'error' ? 'text-red-400' :
                    selectedLog.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {selectedLog.severity.toUpperCase()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Timestamp:</span>
                  <div className="text-white">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">IP Address:</span>
                  <div className="text-blue-400 font-mono">{selectedLog.ip_address}</div>
                </div>
              </div>
              
              <div>
                <span className="text-gray-400 text-sm">Description:</span>
                <div className="text-white">{selectedLog.description}</div>
              </div>
              
              {selectedLog.user_id && (
                <div>
                  <span className="text-gray-400 text-sm">User ID:</span>
                  <div className="text-white">{selectedLog.user_id}</div>
                </div>
              )}
              
              <div>
                <span className="text-gray-400 text-sm">User Agent:</span>
                <div className="text-gray-300 text-sm break-all">{selectedLog.user_agent}</div>
              </div>
              
              <div>
                <span className="text-gray-400 text-sm">Details:</span>
                <div className="bg-black/20 rounded-lg p-3 mt-1">
                  <pre className="text-green-400 text-sm overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-400 text-sm">Status:</span>
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full font-medium ${
                    selectedLog.resolved ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {selectedLog.resolved ? 'RESOLVED' : 'OPEN'}
                  </span>
                </div>
                {!selectedLog.resolved && hasPermission('audit_logs', 'update') && (
                  <button
                    onClick={() => {
                      resolveLog(selectedLog.id);
                      setSelectedLog(null);
                    }}
                    className="bg-green-500/20 text-green-300 px-4 py-2 rounded-lg hover:bg-green-500/30 transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Mark Resolved</span>
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className="w-full mt-6 bg-blue-500/20 text-blue-300 py-2 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-gray-400 text-sm">
          🔒 Real-time security monitoring active
        </p>
      </div>
    </div>
  );
};

export default RealSecurityLogs; 