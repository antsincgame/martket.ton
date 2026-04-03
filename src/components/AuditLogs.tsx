import { useState, useEffect, type FC } from 'react';
import { FileText, Clock, User, AlertCircle, CheckCircle, Server, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Log {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  result: string;
  ip_address: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const AuditLogs: FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_COMMERCE_API_URL || 'http://localhost:8081';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setLogs([]);
        return;
      }

      const response = await fetch(`${apiUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      setLogs(json.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4 text-purple-400" />
        <p className="text-gray-400">Загрузка логов...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-500/10 rounded-lg">
        <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-400" />
        <p className="text-red-400 font-semibold">Ошибка загрузки логов</p>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={fetchLogs} className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors">
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <FileText className="mr-3 text-purple-400" />
          Audit Logs
        </h2>
        <button
          onClick={fetchLogs}
          className="bg-purple-500/20 text-purple-300 px-4 py-2 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Обновить</span>
        </button>
      </div>

      <div className="bg-white/5 rounded-lg border border-white/10">
        <div className="max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-400">Нет записей аудита</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-4 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
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
                        {log.action.replace(/_/g, ' ')} on <span className="text-purple-300">{log.resource.replace(/_/g, ' ')}</span>
                      </p>
                      <div className="text-xs text-gray-400 flex items-center space-x-4 mt-1">
                        <span className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {log.user_id?.slice(0, 8) || 'system'}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                        {log.ip_address && (
                          <span className="flex items-center">
                            <Server className="w-3 h-3 mr-1" />
                            {log.ip_address}
                          </span>
                        )}
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
    </div>
  );
};

export default AuditLogs;
