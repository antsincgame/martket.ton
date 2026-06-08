import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Download, Filter, ExternalLink,
  AlertTriangle, CheckCircle, Eye, ChevronDown, ChevronUp,
  Shield, Globe, Activity, FileText, BarChart3, ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';

const CYBER = {
  voidBlack: '#000000',
  asphalt: '#050507',
  surface: '#0F0F18',
  surfaceHi: '#16162A',
  acidCyan: '#00FFE5',
  hotMagenta: '#FF006E',
  toxicLime: '#C6FF00',
  electricBlue: '#0080FF',
  voltageYellow: '#FFD600',
  bloodRed: '#FF0040',
  alertOrange: '#FF6B00',
  textHi: '#FFFFFF',
  textMid: '#8A8AA8',
  textLo: '#4A4A6A',
} as const;

interface LedgerEntry {
  id: string;
  entryType: string;
  refType: string;
  refId: string;
  buyerWallet: string | null;
  sellerWallet: string | null;
  buyerProfileId: string | null;
  sellerProfileId: string | null;
  amountUsd: number;
  amountTonRaw: string;
  tonUsdRate: number | null;
  platformFeeUsd: number;
  platformFeeTonRaw: string;
  txHash: string | null;
  escrowAddress: string | null;
  licenseAddress: string | null;
  productName: string;
  listingId: string | null;
  buyerCountry: string | null;
  buyerIpCountry: string | null;
  sellerCountry: string | null;
  buyerIp: string | null;
  geoKycMatch: boolean;
  jurisdiction: string;
  complianceStatus: string;
  notes: string | null;
  createdAt: string;
}

interface LedgerStats {
  totalEntries: number;
  totalVolumeUsd: number;
  totalFeesUsd: number;
  byJurisdiction: Record<string, { count: number; volumeUsd: number }>;
  byEntryType: Record<string, { count: number; volumeUsd: number }>;
  byCountry: Record<string, { count: number; volumeUsd: number }>;
  vpnConflicts: number;
  pendingReview: number;
}

async function ledgerFetch<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const res = await fetch(storeApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json.data ?? json;
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  return String.fromCodePoint(...[...upper].map((c) => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

function formatTon(raw: string): string {
  const n = Number(raw);
  if (!n) return '0';
  return (n / 1e9).toFixed(4);
}

function formatUsd(val: number): string {
  if (val < 0) return `-$${Math.abs(val).toFixed(2)}`;
  return `$${val.toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function truncAddr(addr: string | null): string {
  if (!addr) return '---';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const STATUS_MAP: Record<string, { color: string; prefix: string }> = {
  clean: { color: CYBER.toxicLime, prefix: '[OK]' },
  review: { color: CYBER.voltageYellow, prefix: '[!]' },
  reported: { color: CYBER.alertOrange, prefix: '[RPT]' },
  flagged: { color: CYBER.bloodRed, prefix: '[ERR]' },
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  purchase: 'PURCHASE',
  sale: 'SALE',
  escrow_fund: 'ESCROW_FUND',
  escrow_release: 'ESCROW_RELEASE',
  platform_fee: 'PLATFORM_FEE',
  refund: 'REFUND',
  mint_license: 'MINT_LICENSE',
  burn_license: 'BURN_LICENSE',
};

const JURISDICTION_COLORS: Record<string, string> = {
  US: CYBER.bloodRed,
  EU: CYBER.electricBlue,
  OTHER: CYBER.textMid,
  UNKNOWN: CYBER.textLo,
};

type SubTab = 'transactions' | 'compliance' | 'reports' | 'export';

const ComplianceLedger = () => {
  const { getToken } = useAuth();
  const [subtab, setSubtab] = useState<SubTab>('transactions');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterJurisdiction, setFilterJurisdiction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVpn, setFilterVpn] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterType) params.set('entryType', filterType);
      if (filterJurisdiction) params.set('jurisdiction', filterJurisdiction);
      if (filterStatus) params.set('complianceStatus', filterStatus);
      if (filterVpn === 'conflict') params.set('geoKycMatch', 'false');
      params.set('limit', '100');
      const qs = params.toString();
      const res = await fetch(storeApiUrl(`/api/admin/ledger${qs ? `?${qs}` : ''}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setEntries(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [getToken, search, filterType, filterJurisdiction, filterStatus, filterVpn]);

  const loadStats = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await ledgerFetch<LedgerStats>('/api/admin/ledger/stats', token);
      setStats(data);
    } catch {
      /* stats are non-critical */
    }
  }, [getToken]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);
  useEffect(() => { void loadStats(); }, [loadStats]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setStatusUpdating(id);
    try {
      const token = await getToken();
      const updated = await ledgerFetch<LedgerEntry>(`/api/admin/ledger/${id}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      void loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      params.set('format', format);
      if (filterType) params.set('entryType', filterType);
      if (filterJurisdiction) params.set('jurisdiction', filterJurisdiction);
      if (filterStatus) params.set('complianceStatus', filterStatus);
      const url = storeApiUrl(`/api/admin/ledger/export?${params.toString()}`);
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ledger-export.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const subtabs: { id: SubTab; label: string; icon: typeof Activity }[] = [
    { id: 'transactions', label: 'TRANSACTIONS', icon: Activity },
    { id: 'compliance', label: 'COMPLIANCE', icon: Shield },
    { id: 'reports', label: 'REPORTS', icon: BarChart3 },
    { id: 'export', label: 'EXPORT', icon: Download },
  ];

  return (
    <div style={{ background: CYBER.voidBlack }} className="min-h-[600px] -m-6 p-6">
      {/* HUD Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[4px]" style={{ color: CYBER.acidCyan }}>
            // COMPLIANCE.LEDGER
          </p>
          <h2 className="text-2xl font-bold uppercase tracking-wider text-white mt-1">
            Financial Ledger
          </h2>
          <p className="font-mono text-xs mt-1" style={{ color: CYBER.textMid }}>
            {`> total_entries: ${total} // append_only_mode`}
          </p>
        </div>
        <button
          onClick={() => { void loadEntries(); void loadStats(); }}
          className="border px-4 py-2 font-mono text-xs uppercase tracking-[2px] transition-colors"
          style={{ borderColor: CYBER.acidCyan, color: CYBER.acidCyan, background: 'transparent' }}
        >
          <RefreshCw className="w-3.5 h-3.5 inline mr-2" />
          REFRESH
        </button>
      </div>

      {/* Stats HUD Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <HudStat label="VOLUME" value={formatUsd(stats.totalVolumeUsd)} accent={CYBER.toxicLime} />
          <HudStat label="FEES" value={formatUsd(stats.totalFeesUsd)} accent={CYBER.voltageYellow} />
          <HudStat label="VPN CONFLICTS" value={String(stats.vpnConflicts)} accent={stats.vpnConflicts > 0 ? CYBER.bloodRed : CYBER.textMid} />
          <HudStat label="PENDING REVIEW" value={String(stats.pendingReview)} accent={stats.pendingReview > 0 ? CYBER.alertOrange : CYBER.textMid} />
        </div>
      )}

      {/* Subtab Navigation */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: `${CYBER.acidCyan}20` }}>
        {subtabs.map((st) => {
          const Icon = st.icon;
          const isActive = subtab === st.id;
          return (
            <button
              key={st.id}
              onClick={() => setSubtab(st.id)}
              className="flex items-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-[2px] transition-all border-b-2"
              style={{
                borderColor: isActive ? CYBER.acidCyan : 'transparent',
                color: isActive ? CYBER.acidCyan : CYBER.textMid,
                background: isActive ? `${CYBER.acidCyan}08` : 'transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {st.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 border px-4 py-3 font-mono text-xs" style={{ borderColor: CYBER.bloodRed, color: CYBER.bloodRed, background: `${CYBER.bloodRed}10` }}>
          [ERR] {error}
          <button onClick={() => setError(null)} className="ml-3 underline">dismiss</button>
        </div>
      )}

      {/* Subtab Content */}
      {subtab === 'transactions' && (
        <TransactionsTab
          entries={entries}
          loading={loading}
          search={search}
          setSearch={setSearch}
          filterType={filterType}
          setFilterType={setFilterType}
          filterJurisdiction={filterJurisdiction}
          setFilterJurisdiction={setFilterJurisdiction}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterVpn={filterVpn}
          setFilterVpn={setFilterVpn}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
        />
      )}
      {subtab === 'compliance' && (
        <ComplianceTab
          entries={entries.filter((e) => !e.geoKycMatch || e.complianceStatus !== 'clean')}
          statusUpdating={statusUpdating}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
      {subtab === 'reports' && <ReportsTab stats={stats} entries={entries} />}
      {subtab === 'export' && <ExportTab onExport={handleExport} />}
    </div>
  );
};

function HudStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="relative p-4" style={{ background: CYBER.surface }}>
      <div className="absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2" style={{ borderColor: accent }} />
      <div className="absolute right-0 top-0 h-2.5 w-2.5 border-r-2 border-t-2" style={{ borderColor: accent }} />
      <div className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2" style={{ borderColor: accent }} />
      <div className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2" style={{ borderColor: accent }} />
      <p className="font-mono text-[10px] uppercase tracking-[3px]" style={{ color: accent }}>// {label}</p>
      <p className="font-mono text-xl font-bold mt-1" style={{ color: accent }}>{value}</p>
    </div>
  );
}

interface TransactionsTabProps {
  entries: LedgerEntry[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterJurisdiction: string;
  setFilterJurisdiction: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterVpn: string;
  setFilterVpn: (v: string) => void;
  expandedId: string | null;
  setExpandedId: (v: string | null) => void;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
}

function TransactionsTab(props: TransactionsTabProps) {
  const { entries, loading, search, setSearch, filterType, setFilterType, filterJurisdiction, setFilterJurisdiction, filterStatus, setFilterStatus, filterVpn, setFilterVpn, expandedId, setExpandedId, filtersOpen, setFiltersOpen } = props;
  return (
    <div>
      {/* Search + Filter Bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: CYBER.textLo }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="> search by tx_hash..."
            className="w-full pl-10 pr-4 py-2 font-mono text-xs border outline-none"
            style={{ background: CYBER.surface, borderColor: `${CYBER.acidCyan}30`, color: CYBER.textHi }}
          />
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-2 px-4 py-2 border font-mono text-xs uppercase tracking-[2px]"
          style={{ borderColor: `${CYBER.acidCyan}30`, color: CYBER.acidCyan, background: filtersOpen ? `${CYBER.acidCyan}10` : 'transparent' }}
        >
          <Filter className="w-3.5 h-3.5" />
          FILTERS
          {filtersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded Filters */}
      {filtersOpen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-4 border" style={{ borderColor: `${CYBER.acidCyan}15`, background: CYBER.surface }}>
          <FilterSelect label="TYPE" value={filterType} onChange={setFilterType} options={[['', 'ALL'], ...Object.entries(ENTRY_TYPE_LABELS)]} />
          <FilterSelect label="JURISDICTION" value={filterJurisdiction} onChange={setFilterJurisdiction} options={[['', 'ALL'], ['US', 'US'], ['EU', 'EU'], ['OTHER', 'OTHER'], ['UNKNOWN', 'UNKNOWN']]} />
          <FilterSelect label="STATUS" value={filterStatus} onChange={setFilterStatus} options={[['', 'ALL'], ['clean', 'CLEAN'], ['review', 'REVIEW'], ['reported', 'REPORTED'], ['flagged', 'FLAGGED']]} />
          <FilterSelect label="VPN" value={filterVpn} onChange={setFilterVpn} options={[['', 'ALL'], ['conflict', 'CONFLICTS ONLY']]} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: CYBER.acidCyan }} />
          <p className="font-mono text-xs" style={{ color: CYBER.textMid }}>{`> loading_ledger...`}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="py-16 text-center border" style={{ borderColor: `${CYBER.textLo}30`, background: CYBER.surface }}>
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: CYBER.textLo }} />
          <p className="font-mono text-xs" style={{ color: CYBER.textMid }}>{`> no_entries_found`}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: `${CYBER.acidCyan}20` }}>
                {['DATE', 'TYPE', 'AMOUNT', 'COUNTRY', 'JUR', 'STATUS', 'TX', ''].map((h) => (
                  <th key={h} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[2px] whitespace-nowrap" style={{ color: CYBER.acidCyan }}>
                    {h && <span className="flex items-center gap-1">{h} {h === 'DATE' && <ArrowUpDown className="w-2.5 h-2.5" />}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const statusInfo = STATUS_MAP[entry.complianceStatus] ?? STATUS_MAP.clean!;
                const jurColor = JURISDICTION_COLORS[entry.jurisdiction] ?? CYBER.textMid;
                const isExpanded = expandedId === entry.id;
                const isRefund = entry.entryType === 'refund';
                return (
                  <TableRowGroup key={entry.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="cursor-pointer transition-colors border-b"
                      style={{
                        borderColor: `${CYBER.textLo}15`,
                        background: isExpanded ? CYBER.surfaceHi : 'transparent',
                      }}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap" style={{ color: CYBER.textMid }}>
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] uppercase tracking-[1px] px-2 py-0.5 border" style={{ borderColor: `${CYBER.acidCyan}30`, color: CYBER.acidCyan }}>
                          {ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-sm font-bold" style={{ color: isRefund ? CYBER.bloodRed : CYBER.toxicLime }}>
                          {isRefund ? '-' : ''}{formatUsd(entry.amountUsd)}
                        </span>
                        <span className="font-mono text-[10px] block" style={{ color: CYBER.textLo }}>
                          {formatTon(entry.amountTonRaw)} TON
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                        {!entry.geoKycMatch ? (
                          <span className="flex items-center gap-1" style={{ color: CYBER.bloodRed }}>
                            <AlertTriangle className="w-3 h-3" />
                            {countryFlag(entry.buyerCountry)} {entry.buyerCountry}
                            <span style={{ color: CYBER.textLo }}>/</span>
                            {countryFlag(entry.buyerIpCountry)} {entry.buyerIpCountry}
                          </span>
                        ) : (
                          <span style={{ color: CYBER.textMid }}>
                            {countryFlag(entry.buyerCountry)} {entry.buyerCountry ?? '---'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 border" style={{ borderColor: `${jurColor}40`, color: jurColor }}>
                          {entry.jurisdiction}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px]" style={{ color: statusInfo.color }}>
                          {statusInfo.prefix} {entry.complianceStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]" style={{ color: CYBER.hotMagenta }}>
                        {entry.txHash ? (
                          <a
                            href={`https://tonviewer.com/transaction/${entry.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 hover:underline"
                            style={{ color: CYBER.hotMagenta }}
                          >
                            0x{truncAddr(entry.txHash)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span style={{ color: CYBER.textLo }}>---</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: CYBER.acidCyan }} /> : <ChevronDown className="w-4 h-4" style={{ color: CYBER.textLo }} />}
                      </td>
                    </tr>
                    {isExpanded && <ExpandedRow entry={entry} />}
                  </TableRowGroup>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TableRowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ExpandedRow({ entry }: { entry: LedgerEntry }) {
  return (
    <tr style={{ background: CYBER.surface }}>
      <td colSpan={8} className="px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <DetailField label="REF_ID" value={entry.refId} mono />
          <DetailField label="PRODUCT" value={entry.productName || '---'} />
          <DetailField label="RATE" value={entry.tonUsdRate != null ? `1 TON = $${entry.tonUsdRate.toFixed(4)}` : 'unavailable'} mono accent={CYBER.voltageYellow} />
          <DetailField label="BUYER" value={truncAddr(entry.buyerWallet)} mono accent={CYBER.electricBlue} />
          <DetailField label="SELLER" value={truncAddr(entry.sellerWallet)} mono accent={CYBER.hotMagenta} />
          <DetailField label="FEE" value={`${formatUsd(entry.platformFeeUsd)} / ${formatTon(entry.platformFeeTonRaw)} TON`} mono accent={CYBER.voltageYellow} />
          {entry.escrowAddress && <DetailField label="ESCROW" value={truncAddr(entry.escrowAddress)} mono accent={CYBER.acidCyan} />}
          {entry.licenseAddress && <DetailField label="LICENSE" value={truncAddr(entry.licenseAddress)} mono accent={CYBER.toxicLime} />}
          <DetailField label="BUYER_IP" value={entry.buyerIp ?? '---'} mono />
          <DetailField label="KYC_COUNTRY" value={entry.buyerCountry ? `${countryFlag(entry.buyerCountry)} ${entry.buyerCountry}` : '---'} />
          <DetailField label="IP_COUNTRY" value={entry.buyerIpCountry ? `${countryFlag(entry.buyerIpCountry)} ${entry.buyerIpCountry}` : '---'} />
          {entry.notes && (
            <div className="col-span-2 md:col-span-3">
              <DetailField label="NOTES" value={entry.notes} accent={CYBER.alertOrange} />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function DetailField({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[2px] mb-0.5" style={{ color: CYBER.textLo }}>// {label}</p>
      <p className={`text-xs ${mono ? 'font-mono' : ''}`} style={{ color: accent ?? CYBER.textMid }}>{value}</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-[2px] block mb-1" style={{ color: CYBER.textLo }}>// {label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 font-mono text-xs border outline-none appearance-none"
        style={{ background: CYBER.surfaceHi, borderColor: `${CYBER.acidCyan}20`, color: CYBER.textHi }}
      >
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  );
}

interface ComplianceTabProps {
  entries: LedgerEntry[];
  statusUpdating: string | null;
  onStatusUpdate: (id: string, status: string) => void;
}

function ComplianceTab({ entries, statusUpdating, onStatusUpdate }: ComplianceTabProps) {
  const vpnConflicts = entries.filter((e) => !e.geoKycMatch);
  const pendingReview = entries.filter((e) => e.complianceStatus === 'review');
  const flagged = entries.filter((e) => e.complianceStatus === 'flagged' || e.complianceStatus === 'reported');

  return (
    <div>
      {/* VPN Conflicts Section */}
      <Section title="VPN / GEOIP CONFLICTS" count={vpnConflicts.length} accent={CYBER.bloodRed}>
        {vpnConflicts.length === 0 ? (
          <EmptyState label="no_vpn_conflicts_detected" />
        ) : (
          vpnConflicts.map((e) => (
            <ComplianceCard key={e.id} entry={e} statusUpdating={statusUpdating} onStatusUpdate={onStatusUpdate} />
          ))
        )}
      </Section>

      {/* Pending Review */}
      <Section title="PENDING REVIEW" count={pendingReview.length} accent={CYBER.voltageYellow}>
        {pendingReview.length === 0 ? (
          <EmptyState label="all_entries_reviewed" />
        ) : (
          pendingReview.map((e) => (
            <ComplianceCard key={e.id} entry={e} statusUpdating={statusUpdating} onStatusUpdate={onStatusUpdate} />
          ))
        )}
      </Section>

      {/* Flagged / Reported */}
      <Section title="FLAGGED / REPORTED" count={flagged.length} accent={CYBER.alertOrange}>
        {flagged.length === 0 ? (
          <EmptyState label="no_flagged_entries" />
        ) : (
          flagged.map((e) => (
            <ComplianceCard key={e.id} entry={e} statusUpdating={statusUpdating} onStatusUpdate={onStatusUpdate} />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-mono text-xs uppercase tracking-[3px]" style={{ color: accent }}>// {title}</h3>
        <span className="font-mono text-[10px] px-2 py-0.5 border" style={{ borderColor: `${accent}40`, color: accent }}>
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-6 text-center border" style={{ borderColor: `${CYBER.textLo}20`, background: CYBER.surface }}>
      <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: CYBER.toxicLime }} />
      <p className="font-mono text-xs" style={{ color: CYBER.textMid }}>{`> ${label}`}</p>
    </div>
  );
}

function ComplianceCard({ entry, statusUpdating, onStatusUpdate }: { entry: LedgerEntry; statusUpdating: string | null; onStatusUpdate: (id: string, status: string) => void }) {
  const isUpdating = statusUpdating === entry.id;
  return (
    <div className="p-4 border" style={{ borderColor: !entry.geoKycMatch ? `${CYBER.bloodRed}30` : `${CYBER.voltageYellow}20`, background: CYBER.surface }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="font-mono text-[11px] uppercase px-2 py-0.5 border" style={{ borderColor: `${CYBER.acidCyan}30`, color: CYBER.acidCyan }}>
              {entry.entryType}
            </span>
            <span className="font-mono text-xs" style={{ color: CYBER.textMid }}>{formatDate(entry.createdAt)}</span>
            {!entry.geoKycMatch && (
              <span className="flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border" style={{ borderColor: `${CYBER.bloodRed}40`, color: CYBER.bloodRed }}>
                <AlertTriangle className="w-3 h-3" /> VPN_CONFLICT
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <DetailField label="AMOUNT" value={formatUsd(entry.amountUsd)} mono accent={CYBER.toxicLime} />
            <DetailField label="KYC" value={entry.buyerCountry ? `${countryFlag(entry.buyerCountry)} ${entry.buyerCountry}` : '---'} />
            <DetailField label="IP" value={entry.buyerIpCountry ? `${countryFlag(entry.buyerIpCountry)} ${entry.buyerIpCountry}` : '---'} />
            <DetailField label="PRODUCT" value={entry.productName || '---'} />
          </div>
          {entry.notes && (
            <p className="mt-2 font-mono text-[11px] px-3 py-1.5 border-l-2" style={{ borderColor: CYBER.alertOrange, color: CYBER.alertOrange }}>
              {entry.notes}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {(['clean', 'review', 'reported', 'flagged'] as const).map((s) => {
            const si = STATUS_MAP[s]!;
            const isCurrent = entry.complianceStatus === s;
            return (
              <button
                key={s}
                disabled={isCurrent || isUpdating}
                onClick={() => onStatusUpdate(entry.id, s)}
                className="px-3 py-1 font-mono text-[10px] uppercase tracking-[1px] border transition-colors disabled:opacity-30"
                style={{
                  borderColor: isCurrent ? si.color : `${si.color}30`,
                  color: si.color,
                  background: isCurrent ? `${si.color}15` : 'transparent',
                }}
              >
                {si.prefix}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ stats, entries: _entries }: { stats: LedgerStats | null; entries: LedgerEntry[] }) {
  if (!stats) {
    return (
      <div className="py-16 text-center">
        <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: CYBER.textLo }} />
        <p className="font-mono text-xs" style={{ color: CYBER.textMid }}>{`> loading_stats...`}</p>
      </div>
    );
  }

  const jurisdictionEntries = Object.entries(stats.byJurisdiction).sort((a, b) => b[1].volumeUsd - a[1].volumeUsd);
  const typeEntries = Object.entries(stats.byEntryType).sort((a, b) => b[1].count - a[1].count);
  const countryEntries = Object.entries(stats.byCountry).sort((a, b) => b[1].volumeUsd - a[1].volumeUsd).slice(0, 15);

  const maxVolume = Math.max(...countryEntries.map(([, v]) => v.volumeUsd), 1);

  return (
    <div>
      {/* Jurisdiction Breakdown */}
      <Section title="BY JURISDICTION" count={jurisdictionEntries.length} accent={CYBER.electricBlue}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {jurisdictionEntries.map(([jur, data]) => (
            <HudStat
              key={jur}
              label={jur}
              value={`${data.count} txn / ${formatUsd(data.volumeUsd)}`}
              accent={JURISDICTION_COLORS[jur] ?? CYBER.textMid}
            />
          ))}
        </div>
      </Section>

      {/* Entry Type Breakdown */}
      <Section title="BY ENTRY TYPE" count={typeEntries.length} accent={CYBER.acidCyan}>
        <div className="space-y-2">
          {typeEntries.map(([etype, data]) => (
            <div key={etype} className="flex items-center gap-3 p-2 border" style={{ borderColor: `${CYBER.acidCyan}10`, background: CYBER.surface }}>
              <span className="font-mono text-[11px] uppercase w-32 shrink-0" style={{ color: CYBER.acidCyan }}>
                {ENTRY_TYPE_LABELS[etype] ?? etype}
              </span>
              <span className="font-mono text-xs" style={{ color: CYBER.textMid }}>{data.count} txn</span>
              <span className="font-mono text-xs font-bold" style={{ color: CYBER.toxicLime }}>{formatUsd(data.volumeUsd)}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Country Breakdown (HUD Bar Chart) */}
      <Section title="TOP COUNTRIES" count={countryEntries.length} accent={CYBER.hotMagenta}>
        <div className="space-y-1">
          {countryEntries.map(([cc, data]) => {
            const pct = (data.volumeUsd / maxVolume) * 100;
            return (
              <div key={cc} className="flex items-center gap-3 py-1.5 px-3" style={{ background: CYBER.surface }}>
                <span className="font-mono text-xs w-10 shrink-0" style={{ color: CYBER.textMid }}>
                  {countryFlag(cc)} {cc}
                </span>
                <div className="flex-1 h-3 relative" style={{ background: `${CYBER.textLo}15` }}>
                  <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: `${CYBER.hotMagenta}60` }} />
                </div>
                <span className="font-mono text-[11px] w-20 text-right shrink-0" style={{ color: CYBER.toxicLime }}>
                  {formatUsd(data.volumeUsd)}
                </span>
                <span className="font-mono text-[10px] w-12 text-right shrink-0" style={{ color: CYBER.textLo }}>
                  {data.count}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* IRS / DAC8 Summary */}
      <Section title="REGULATORY SUMMARY" count={0} accent={CYBER.voltageYellow}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 border" style={{ borderColor: `${CYBER.bloodRed}20`, background: CYBER.surface }}>
            <p className="font-mono text-[10px] uppercase tracking-[3px] mb-2" style={{ color: CYBER.bloodRed }}>// IRS 1099-DA (US NEXUS)</p>
            <p className="font-mono text-lg font-bold" style={{ color: CYBER.bloodRed }}>
              {stats.byJurisdiction['US']?.count ?? 0} transactions
            </p>
            <p className="font-mono text-xs mt-1" style={{ color: CYBER.textMid }}>
              Volume: {formatUsd(stats.byJurisdiction['US']?.volumeUsd ?? 0)}
            </p>
          </div>
          <div className="p-4 border" style={{ borderColor: `${CYBER.electricBlue}20`, background: CYBER.surface }}>
            <p className="font-mono text-[10px] uppercase tracking-[3px] mb-2" style={{ color: CYBER.electricBlue }}>// DAC8 / MiCA (EU NEXUS)</p>
            <p className="font-mono text-lg font-bold" style={{ color: CYBER.electricBlue }}>
              {stats.byJurisdiction['EU']?.count ?? 0} transactions
            </p>
            <p className="font-mono text-xs mt-1" style={{ color: CYBER.textMid }}>
              Volume: {formatUsd(stats.byJurisdiction['EU']?.volumeUsd ?? 0)}
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function ExportTab({ onExport }: { onExport: (format: 'csv' | 'json') => void }) {
  return (
    <div>
      <Section title="EXPORT LEDGER DATA" count={0} accent={CYBER.acidCyan}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExportCard
            title="CSV EXPORT"
            description="Spreadsheet-compatible format for accounting software (QuickBooks, Xero, Excel)"
            icon={FileText}
            accent={CYBER.toxicLime}
            onExport={() => onExport('csv')}
          />
          <ExportCard
            title="JSON EXPORT"
            description="Machine-readable format for API integrations and custom processing"
            icon={Globe}
            accent={CYBER.electricBlue}
            onExport={() => onExport('json')}
          />
        </div>
      </Section>

      <Section title="PRESETS" count={0} accent={CYBER.voltageYellow}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PresetCard label="IRS 1099-DA" description="US nexus transactions for IRS reporting" accent={CYBER.bloodRed} icon={Shield} />
          <PresetCard label="DAC8 REPORT" description="EU nexus transactions for DAC8 compliance" accent={CYBER.electricBlue} icon={Globe} />
          <PresetCard label="VPN AUDIT" description="All GeoIP/KYC conflicts for manual review" accent={CYBER.alertOrange} icon={Eye} />
        </div>
      </Section>
    </div>
  );
}

function ExportCard({ title, description, icon: Icon, accent, onExport }: { title: string; description: string; icon: typeof FileText; accent: string; onExport: () => void }) {
  return (
    <div className="relative p-5 border cursor-pointer transition-colors" style={{ borderColor: `${accent}20`, background: CYBER.surface }} onClick={onExport}>
      <div className="absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2" style={{ borderColor: accent }} />
      <div className="absolute right-0 bottom-0 h-2.5 w-2.5 border-r-2 border-b-2" style={{ borderColor: accent }} />
      <Icon className="w-8 h-8 mb-3" style={{ color: accent }} />
      <h4 className="font-mono text-sm font-bold uppercase tracking-[2px] mb-1" style={{ color: accent }}>{`> ${title}`}</h4>
      <p className="text-xs" style={{ color: CYBER.textMid }}>{description}</p>
      <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[2px]" style={{ color: accent }}>
        <Download className="w-3 h-3" /> DOWNLOAD
      </div>
    </div>
  );
}

function PresetCard({ label, description, accent, icon: Icon }: { label: string; description: string; accent: string; icon: typeof Shield }) {
  return (
    <div className="p-4 border" style={{ borderColor: `${accent}15`, background: CYBER.surface }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="font-mono text-[11px] font-bold uppercase tracking-[2px]" style={{ color: accent }}>{label}</span>
      </div>
      <p className="text-[11px]" style={{ color: CYBER.textMid }}>{description}</p>
    </div>
  );
}

export default ComplianceLedger;
