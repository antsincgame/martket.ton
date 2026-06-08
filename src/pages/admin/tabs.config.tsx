import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  Shield,
  Users,
  Database,
  Settings,
  BarChart,
  FileText,
  Coins,
  Mail,
  Folder,
  MessageCircle,
  ShieldCheck,
  Bug,
  BookOpen,
  ScrollText,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';

const SecurityMonitor = lazy(() => import('../../components/SecurityMonitor'));
const RealUserManagement = lazy(() => import('../../components/RealUserManagement'));
const AuditLogs = lazy(() => import('../../components/AuditLogs'));
const CommerceAdminPanel = lazy(() => import('../../components/admin/CommerceAdminPanel'));
const AgentInstructionsPanel = lazy(() => import('../../components/admin/AgentInstructionsPanel'));
const AmlCompliancePanel = lazy(() => import('../../components/admin/AmlCompliancePanel'));
const ProductModerationQueue = lazy(() => import('../../components/admin/ProductModerationQueue'));
const ResendSettings = lazy(() => import('../../components/admin/ResendSettings'));
const CategoryManagement = lazy(() => import('../../components/admin/CategoryManagement'));
const AnalyticsDashboard = lazy(() => import('../../components/admin/AnalyticsDashboard'));
const SystemConfig = lazy(() => import('../../components/admin/SystemConfig'));
const VerifiedDemiurges = lazy(() => import('../../components/admin/VerifiedDemiurges'));
const ClientErrorsPanel = lazy(() => import('../../components/admin/ClientErrorsPanel'));
const ComplianceLedger = lazy(() => import('../../components/admin/ComplianceLedger'));

const SupportAdmin = lazy(async () => {
  const mod = await import('../../components/admin/SupportTickets');
  const Component = mod.default;
  return {
    default: () => <Component isAdminView />,
  };
});

export interface AdminPermission {
  resource: string;
  action: string;
}

export interface AdminTab {
  id: string;
  label: string;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType<unknown>> | LazyExoticComponent<ComponentType>;
  requiredPermission: AdminPermission;
}

export const ADMIN_TABS: readonly AdminTab[] = [
  { id: 'security', label: 'Security', icon: Shield, component: SecurityMonitor, requiredPermission: { resource: '*', action: 'read' } },
  { id: 'users', label: 'Users', icon: Users, component: RealUserManagement, requiredPermission: { resource: 'users', action: 'read' } },
  { id: 'audit', label: 'Audit', icon: FileText, component: AuditLogs, requiredPermission: { resource: 'audit_logs', action: 'read' } },
  { id: 'analytics', label: 'Analytics', icon: BarChart, component: AnalyticsDashboard, requiredPermission: { resource: 'analytics', action: 'read' } },
  { id: 'products', label: 'Moderation', icon: Database, component: ProductModerationQueue, requiredPermission: { resource: 'products', action: 'read' } },
  { id: 'verified', label: 'Verified', icon: ShieldCheck, component: VerifiedDemiurges, requiredPermission: { resource: 'users', action: 'update' } },
  { id: 'categories', label: 'Categories', icon: Folder, component: CategoryManagement, requiredPermission: { resource: 'categories', action: 'read' } },
  { id: 'ledger', label: 'Ledger', icon: BookOpen, component: ComplianceLedger, requiredPermission: { resource: '*', action: 'read' } },
  { id: 'commerce', label: 'Commerce', icon: Coins, component: CommerceAdminPanel, requiredPermission: { resource: 'products', action: 'read' } },
  { id: 'agent-docs', label: 'Agent Docs', icon: ScrollText, component: AgentInstructionsPanel, requiredPermission: { resource: 'products', action: 'read' } },
  { id: 'aml', label: 'AML', icon: ShieldAlert, component: AmlCompliancePanel, requiredPermission: { resource: '*', action: 'read' } },
  { id: 'email', label: 'Email', icon: Mail, component: ResendSettings, requiredPermission: { resource: '*', action: 'update' } },
  { id: 'support', label: 'Support', icon: MessageCircle, component: SupportAdmin, requiredPermission: { resource: '*', action: 'read' } },
  { id: 'errors', label: 'Errors', icon: Bug, component: ClientErrorsPanel, requiredPermission: { resource: 'audit_logs', action: 'read' } },
  { id: 'system', label: 'System', icon: Settings, component: SystemConfig, requiredPermission: { resource: '*', action: 'update' } },
] as const;

export const DEFAULT_ADMIN_TAB_ID = ADMIN_TABS[0].id;
