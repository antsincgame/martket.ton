import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as ClerkReact from '@clerk/clerk-react';
import { X } from 'lucide-react';

export const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const useClerkUser = ClerkReact.useUser;
export const useClerkAuth = ClerkReact.useAuth;

export function useClerkAuthForRoute() {
  if (!CLERK_CONFIGURED) return { isSignedIn: false };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { isSignedIn } = ClerkReact.useAuth();
    return { isSignedIn: !!isSignedIn };
  } catch {
    return { isSignedIn: false };
  }
}

export function useClerkUserStub() {
  return { user: null, isLoaded: true, isSignedIn: false as const };
}

export function useClerkAuthStub() {
  return {
    isSignedIn: false as const,
    isLoaded: true,
    userId: null as string | null,
    getToken: async () => null as string | null,
  };
}

export const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!CLERK_CONFIGURED) return null;
  return <ClerkReact.SignedIn>{children}</ClerkReact.SignedIn>;
};

export const SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!CLERK_CONFIGURED) return <>{children}</>;
  return <ClerkReact.SignedOut>{children}</ClerkReact.SignedOut>;
};

export const UserButton: React.FC<Record<string, unknown>> = (props) => {
  if (!CLERK_CONFIGURED) return null;
  return <ClerkReact.UserButton {...props} />;
};

// --- Auth Modal (desktop: modal, mobile: full page /sign-in) ---

type AuthModalMode = 'sign-in' | 'sign-up';

interface AuthModalContextValue {
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export const useAuthModal = () => useContext(AuthModalContext);

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return mobile;
}

export const AuthModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>('sign-in');

  const openAuthModal = useCallback((m: AuthModalMode = 'sign-in') => {
    setMode(m);
    setIsOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  return (
    <AuthModalContext.Provider value={{ openAuthModal, closeAuthModal }}>
      {children}
      {CLERK_CONFIGURED && isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal(); }}
        >
          <div className="relative w-full max-w-md mx-4 animate-fade-in">
            <button
              onClick={closeAuthModal}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-[#FFD700]/50 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            {mode === 'sign-in' ? (
              <ClerkReact.SignIn afterSignInUrl="/profile" />
            ) : (
              <ClerkReact.SignUp afterSignUpUrl="/profile" />
            )}
          </div>
        </div>
      )}
    </AuthModalContext.Provider>
  );
};

// --- Fallback page components (for mobile /sign-in route) ---

export const ClerkSignIn: React.FC<Record<string, unknown>> = (props) => {
  if (!CLERK_CONFIGURED) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-bold text-white mb-4">Authentication Not Configured</h2>
        <p className="text-gray-400">
          Set <code className="bg-white/10 px-2 py-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> in your .env file.
        </p>
      </div>
    );
  }
  return <ClerkReact.SignIn {...props} />;
};

export const ClerkSignUp: React.FC<Record<string, unknown>> = (props) => {
  if (!CLERK_CONFIGURED) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-bold text-white mb-4">Authentication Not Configured</h2>
        <p className="text-gray-400">
          Set <code className="bg-white/10 px-2 py-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> in your .env file.
        </p>
      </div>
    );
  }
  return <ClerkReact.SignUp {...props} />;
};
