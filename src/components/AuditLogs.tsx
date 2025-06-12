import React, { useState, useEffect } from 'react';
import { FileText, Clock, User, AlertCircle, CheckCircle, Server, RefreshCw } from 'lucide-react';

interface Log {
  _id: string;
  timestamp: string;
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'partial';
  userId: string;
  ipAddress: string;
}

// Mock audit logs data
const generateMockLogs = (): Log[] => {
  const actions = ['login', 'logout', 'create_product', 'update_user', 'delete_item', 'admin_access', 'view_dashboard'];
  const resources = ['user_management', 'product_catalog', 'security_center', 'admin_panel', 'audit_logs'];
  const users = ['admin-1', 'mantra-admin', 'user-123', 'developer-456'];
  const ips = ['192.168.1.100', '10.0.0.45', '172.16.0.12', 'localhost'];

  return Array.from({ length: 25 }, (_, i) => ({
    _id: `log-${i + 1}`,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    action: actions[Math.floor(Math.random() * actions.length)],
    resource: resources[Math.floor(Math.random() * resources.length)],
    result: Math.random() > 0.1 ? 'success' : (Math.random() > 0.5 ? 'failure' : 'partial'),
    userId: users[Math.floor(Math.random() * users.length)],
    ipAddress: ips[Math.floor(Math.random() * ips.length)]
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const AuditLogs = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate mock data
      const mockData = generateMockLogs();
      setLogs(mockData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4 text-purple-400" />
        <p className="text-gray-400">Loading karmic records... 🕉️</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-500/10 rounded-lg">
        <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-400" />
        <p className="text-red-400 font-semibold">Error retrieving Karmic Records</p>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={fetchLogs} className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
        <FileText className="mr-3 text-purple-400" />
          Karmic Audit Logs 📜
      </h2>
        <button 
          onClick={fetchLogs} 
          className="bg-purple-500/20 text-purple-300 px-4 py-2 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>
      
      <div className="bg-white/5 rounded-lg border border-white/10">
        <div className="max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-400">No karmic records found</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log._id} className="p-4 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
              <div className="flex items-center">
                {log.result === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-400 mr-4 flex-shrink-0" />
                    ) : log.result === 'failure' ? (
                      <AlertCircle className="w-5 h-5 text-red-400 mr-4 flex-shrink-0" />
                ) : (
                      <Clock className="w-5 h-5 text-yellow-400 mr-4 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-white">
                        {log.action.replace('_', ' ')} on <span className="text-purple-300">{log.resource.replace('_', ' ')}</span>
                  </p>
                  <div className="text-xs text-gray-400 flex items-center space-x-4 mt-1">
                        <span className="flex items-center">
                          <User className="w-3 h-3 mr-1" /> 
                          {log.userId}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" /> 
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className="flex items-center">
                          <Server className="w-3 h-3 mr-1" /> 
                          {log.ipAddress}
                        </span>
                  </div>
                </div>
              </div>
                  <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                    log.result === 'success' ? 'bg-green-500/20 text-green-300' : 
                    log.result === 'failure' ? 'bg-red-500/20 text-red-300' : 
                    'bg-yellow-500/20 text-yellow-300'
              }`}>
                {log.result}
              </span>
            </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-gray-400 text-sm">
          🪷 All actions are recorded in the cosmic database for karmic accountability ☸️
        </p>
      </div>
    </div>
  );
};

export default AuditLogs; 