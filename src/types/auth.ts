// Authentication and Security Types for TON Web Store Admin Panel

export interface TONWalletAuth {
  address: string;
  publicKey: string;
  signature: string;
  timestamp: number;
  network: 'mainnet' | 'testnet';
}

export interface MFAMethod {
  id: string;
  type: 'totp' | 'webauthn' | 'sms' | 'email' | 'biometric';
  name: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

export interface UserRole {
  id: string;
  name: 'super_admin' | 'admin' | 'moderator' | 'developer' | 'support' | 'analyst' | 'viewer' | 'auditor';
  permissions: Permission[];
  sessionDuration: number; // in minutes
  requiresMFA: boolean;
  allowedIPs?: string[];
  description: string;
}

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'approve' | 'ban')[];
  conditions?: Record<string, string | number | boolean>;
}

export interface AuthenticatedUser {
  id: string;
  tonAddress: string;
  email?: string;
  username?: string;
  role: string;
  roles: UserRole[];
  permissions: Permission[];
  mfaMethods: MFAMethod[];
  mfaEnabled: boolean;
  lastLogin: string;
  loginHistory?: LoginAttempt[];
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  securityFlags: SecurityFlag[];
  isActive?: boolean;
  sessionDuration: number;
  requiresMFA: boolean;
  description: string;
  profile: UserProfile;
  stats: Stats;
  library: LibraryItem[];
  products: Product[];
  achievements: Achievement[];
}

export interface LoginAttempt {
  id: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  method: 'ton_wallet' | 'mfa' | 'backup';
  location?: {
    country: string;
    city: string;
    coordinates?: [number, number];
  };
  riskScore: number;
  blockedReason?: string;
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  tonAddress: string;
  roles: UserRole[];
  permissions: Permission[];
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  mfaVerified: boolean;
  securityFlags: SecurityFlag[];
}

export interface SecurityFlag {
  type: 'suspicious_location' | 'new_device' | 'multiple_sessions' | 'admin_action' | 'high_risk_operation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  resolved: boolean;
}

export interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'permission_denied' | 'suspicious_activity' | 'data_access' | 'configuration_change';
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: Record<string, string | number | boolean>;
  automated_response?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  sessionId: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, string | number | boolean>;
  newValues?: Record<string, string | number | boolean>;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure' | 'partial';
  metadata?: Record<string, string | number | boolean>;
}

// Auth Context Types
export interface AuthContextValue {
  user: AuthenticatedUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  securityAlerts: SecurityFlag[];
  sacredAccess: SacredAccess | null;
  error: string | null;
  loginAttempts: { timestamp: number; count: number };
  securityEvents: SecurityEvent[];
  
  // Authentication methods
  authenticateWithTON: (walletData: TONWalletAuth) => Promise<AuthResult>;
  authenticateWithMFA: (method: string, code: string) => Promise<AuthResult>;
  authenticateWithMantra: (credentials: { email: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  
  // Permission checks
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (roleName: string) => boolean;
  getSecurityLevel: () => string;
  
  // Security monitoring
  reportSecurityEvent: (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => void;
  clearSecurityAlerts: () => void;
  getSecurityAlerts: () => SecurityFlag[];
  logAuditEvent: (action: string, resource: string, result: string, metadata?: Record<string, unknown>) => void;
}

export interface AuthResult {
  success: boolean;
  requiresMFA: boolean;
  mfaMethods?: MFAMethod[];
  session?: AuthSession;
  error?: string;
  securityWarnings?: string[];
}

// Configuration types
export interface SecurityConfig {
  session: {
    maxDuration: number;
    extendOnActivity: boolean;
    maxConcurrentSessions: number;
  };
  mfa: {
    required: boolean;
    gracePeriod: number;
    backupCodes: number;
  };
  rateLimit: {
    loginAttempts: number;
    windowMinutes: number;
    blockDuration: number;
  };
  security: {
    allowedCountries?: string[];
    blockedIPs?: string[];
    requireVPN: boolean;
    minPasswordStrength: number;
  };
}

// Sacred Admin Access (White Tara) types
export interface SacredAccess {
  isActivated: boolean;
  activatedBy?: string;
  activatedAt?: Date;
  sacredLevel: 'initiate' | 'adept' | 'master' | 'bodhisattva';
  specialPermissions: string[];
  cosmicSession?: {
    sessionId: string;
    celestialAlignment: boolean;
    karmaLevel: number;
    enlightenmentPoints: number;
  };
}

export interface WhiteTaraSession extends AuthSession {
  sacredAccess: SacredAccess;
  divinePermissions: string[];
  spiritualMetrics: {
    compassion: number;
    wisdom: number;
    mindfulness: number;
    generosity: number;
  };
}

export interface UserProfile {
  displayName: string;
  bio?: string;
  avatar?: string;
}

export interface Stats {
  totalSpent: number;
  totalDonated: number;
  karmaPoints: number;
  appsOwned: number;
  productsPublished: number;
  totalDownloads: number;
  donationsReceived: number;
  avgRating: number;
  totalReviews: number;
}

export interface Product {
  id: string;
  name: string;
  downloads: number;
  rating: number;
  price: number;
  image: string;
}

export interface LibraryItem {
  id: string;
  name:string;
  developer: string;
  purchaseDate: string;
  price: number;
  image: string;
}

export interface Achievement {
  icon: string;
  name: string;
  description: string;
} 