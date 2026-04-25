import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Gem, AlertTriangle, Loader2 } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { completeOAuthCallback } from '../../lib/appwriteAuth';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

/**
 * Handles OAuth redirects (GitHub). Appwrite returns
 * `?userId=<id>&secret=<token>` — we exchange them for a session.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { fetchProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) {
      logger.warn('[AUTH_AUDIT] AuthCallbackPage — skipping duplicate effect run');
      return;
    }
    const userId = params.get('userId') || '';
    const secret = params.get('secret') || '';
    logger.warn('[AUTH_AUDIT] AuthCallbackPage effect fired', {
      userId: userId || '(empty)',
      secretLen: secret.length,
      url: window.location.href,
    });
    if (!userId || !secret) {
      logger.warn('[AUTH_AUDIT] AuthCallbackPage — missing userId or secret');
      setError('Invalid sign-in link. Please request a new one.');
      return;
    }
    processedRef.current = true;
    (async () => {
      try {
        logger.warn('[AUTH_AUDIT] step 1/4 — calling completeOAuthCallback');
        await completeOAuthCallback(userId, secret);

        logger.warn('[AUTH_AUDIT] step 2/4 — session created, waiting 500ms for propagation');
        await new Promise(r => setTimeout(r, 500));

        logger.warn('[AUTH_AUDIT] step 3/4 — calling fetchProfile');
        await fetchProfile();

        logger.warn('[AUTH_AUDIT] step 4/4 — navigating to /');
        navigate('/', { replace: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Sign-in failed';
        logger.warn('[AUTH_AUDIT] AuthCallbackPage — FATAL error in OAuth flow:', msg);
        setError(msg);
      }
    })();
  }, [params, navigate, fetchProfile]);

  if (error) {
    return (
      <AuthLayout title="Sign-in failed">
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-[#FF4444]/10 border border-[#FF4444]/30 mx-auto flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-[#FF6666]" />
          </div>
          <p className="text-sm text-[#aaa] mb-6">{error}</p>
          <Link
            to="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ton-gradient px-5 py-3 text-[#0A0A0A] font-semibold hover:shadow-[0_0_25px_rgba(255,215,0,0.3)] transition-shadow"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Signing you in" subtitle="Just a moment...">
      <div className="flex flex-col items-center justify-center py-6 gap-4">
        <div className="relative">
          <Gem className="w-10 h-10 text-[#FFD700] animate-pulse" />
          <Loader2 className="w-14 h-14 text-[#FFD700]/30 animate-spin absolute -inset-2" />
        </div>
        <p className="text-sm text-[#888]">Verifying your credentials</p>
      </div>
    </AuthLayout>
  );
}
