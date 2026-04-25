import { useState } from 'react';
import { Bug, Clock, Globe, Monitor, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { useAuditLogs } from '../../hooks/useAdminData';

interface ErrorMeta {
  message?: string;
  pathname?: string;
  stack?: string;
  viewport?: string;
  userAgent?: string;
  resetKey?: string;
}

function parseMeta(raw: unknown): ErrorMeta {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as ErrorMeta; } catch { return {}; }
  }
  return (raw as ErrorMeta) ?? {};
}

function isStaleChunkError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes('dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Importing a module script failed') ||
    message.includes('Failed to fetch dynamically')
  );
}

const ClientErrorsPanel = () => {
  const { data: logs = [], isLoading, error, refetch } = useAuditLogs(200);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showStale, setShowStale] = useState(false);

  const allErrors = logs.filter((l) => l.action === 'client_error');
  const staleCount = allErrors.filter((l) => isStaleChunkError(parseMeta(l.metadata).message)).length;
  const clientErrors = showStale
    ? allErrors
    : allErrors.filter((l) => !isStaleChunkError(parseMeta(l.metadata).message));

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4 text-red-400" />
        <p className="text-gray-400">Loading client errors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-500/10 rounded-lg">
        <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-400" />
        <p className="text-red-400 font-semibold">Failed to load errors</p>
        <p className="text-gray-400 text-sm mb-4">{error.message}</p>
        <button onClick={() => refetch()} className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-400" />
            Client Errors
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {clientErrors.length} error{clientErrors.length !== 1 ? 's' : ''} captured from frontend
            {staleCount > 0 && !showStale && (
              <span className="ml-2 text-yellow-400/80 text-xs">
                · {staleCount} stale chunk error{staleCount !== 1 ? 's' : ''} hidden
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {staleCount > 0 && (
            <button
              onClick={() => setShowStale((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg"
            >
              {showStale ? 'Hide stale' : 'Show stale'}
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {clientErrors.length === 0 && (
        <div className="text-center p-12 bg-white/5 rounded-xl border border-white/10">
          <Bug className="w-12 h-12 mx-auto mb-4 text-green-400 opacity-50" />
          <p className="text-gray-300 font-medium">No client errors recorded</p>
          <p className="text-gray-500 text-sm mt-1">Errors from the frontend ErrorBoundary will appear here</p>
        </div>
      )}

      <div className="space-y-3">
        {clientErrors.map((log) => {
          const meta = parseMeta(log.metadata);
          const isExpanded = expandedId === log.id;

          return (
            <div
              key={log.id}
              className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-red-500/20 transition-colors"
            >
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex items-start gap-3"
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">
                    {meta.message || 'Unknown error'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    {meta.pathname && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {meta.pathname}
                      </span>
                    )}
                    {meta.viewport && (
                      <span className="flex items-center gap-1">
                        <Monitor className="w-3 h-3" />
                        {meta.viewport}
                      </span>
                    )}
                    {log.resource_id && (
                      <span className="text-gray-600 font-mono">
                        {log.resource_id}
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500 mt-1 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500 mt-1 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                  {meta.stack && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Stack Trace</span>
                        <button
                          onClick={() => handleCopy(log.id, meta.stack ?? '')}
                          className="text-gray-500 hover:text-white transition-colors p-1"
                        >
                          {copiedId === log.id
                            ? <Check className="w-3.5 h-3.5 text-green-400" />
                            : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <pre className="bg-black/40 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-auto max-h-48 whitespace-pre-wrap">
                        {meta.stack}
                      </pre>
                    </div>
                  )}
                  {meta.userAgent && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">User Agent</span>
                      <p className="text-xs text-gray-400 font-mono mt-1 break-all">{meta.userAgent}</p>
                    </div>
                  )}
                  {log.ip_address && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">IP</span>
                      <p className="text-xs text-gray-400 font-mono mt-1">{log.ip_address}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClientErrorsPanel;
