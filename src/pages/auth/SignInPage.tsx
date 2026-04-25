import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Mail, ArrowLeft, Loader2, MessageCircle, KeyRound, RefreshCw } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { sendEmailOtp, verifyEmailOtp, startGithubOAuth } from '../../lib/appwriteAuth';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

type View = 'choose' | 'email' | 'otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, fetchProfile } = useAuth();
  const [view, setView] = useState<View>('choose');
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [otpUserId, setOtpUserId] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/profile', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleGithub = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await startGithubOAuth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'GitHub sign-in unavailable';
      logger.warn('[sign-in] github failed:', msg);
      setError(msg);
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { userId } = await sendEmailOtp(trimmed);
      setSubmittedEmail(trimmed);
      setOtpUserId(userId);
      setOtp('');
      setView('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send code';
      logger.warn('[sign-in] OTP send failed:', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    const trimmed = otp.trim();
    if (trimmed.length < 6) {
      setError('Enter the 6-digit code from the email');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(otpUserId, trimmed);
      // Small delay to let the Appwrite session propagate before JWT minting.
      await new Promise(r => setTimeout(r, 500));
      await fetchProfile();
      navigate('/profile', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      logger.warn('[sign-in] OTP verify failed:', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { userId } = await sendEmailOtp(submittedEmail);
      setOtpUserId(userId);
      setOtp('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={view === 'choose' ? 'Welcome back' : view === 'email' ? 'Sign in with email' : 'Enter the code'}
      subtitle={
        view === 'choose' ? 'Choose how you want to enter'
          : view === 'email' ? 'We will send a one-time code'
          : `Code sent to ${submittedEmail}`
      }
    >
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[#FF4444]/10 border border-[#FF4444]/30 text-sm text-[#FF8080]">
          {error}
        </div>
      )}

      {view === 'choose' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGithub}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white hover:bg-white/10 hover:border-[#FFD700]/40 transition-all disabled:opacity-60 disabled:cursor-wait"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Github className="w-5 h-5" />}
            <span className="font-medium">{busy ? 'Redirecting...' : 'Continue with GitHub'}</span>
          </button>

          <button
            type="button"
            disabled
            title="Coming soon"
            className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-[#0088cc]/20 bg-[#0088cc]/5 px-4 py-3 text-[#7AAFD0] cursor-not-allowed"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="font-medium">Continue with Telegram</span>
            <span className="ml-2 text-[10px] uppercase tracking-widest text-[#888] border border-[#888]/30 px-1.5 py-0.5 rounded">
              Soon
            </span>
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs uppercase tracking-widest text-[#666]">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            type="button"
            onClick={() => { setView('email'); setError(null); }}
            className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-ton-gradient px-4 py-3 text-[#0A0A0A] font-semibold hover:shadow-[0_0_25px_rgba(255,215,0,0.3)] transition-shadow"
          >
            <Mail className="w-5 h-5" />
            <span>Continue with Email</span>
          </button>
        </div>
      )}

      {view === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <button
            type="button"
            onClick={() => { setView('choose'); setError(null); }}
            className="inline-flex items-center gap-1 text-sm text-[#888] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div>
            <label htmlFor="email" className="block text-xs uppercase tracking-widest text-[#888] mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#555] focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ton-gradient px-4 py-3 text-[#0A0A0A] font-semibold hover:shadow-[0_0_25px_rgba(255,215,0,0.3)] transition-shadow disabled:opacity-60 disabled:cursor-wait"
          >
            {busy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5" />
                Send code
              </>
            )}
          </button>
        </form>
      )}

      {view === 'otp' && (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <button
            type="button"
            onClick={() => { setView('email'); setError(null); setOtp(''); }}
            className="inline-flex items-center gap-1 text-sm text-[#888] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Change email
          </button>

          <div>
            <label htmlFor="otp" className="block text-xs uppercase tracking-widest text-[#888] mb-2">
              One-time code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder:text-[#333] focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={busy || otp.length < 6}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ton-gradient px-4 py-3 text-[#0A0A0A] font-semibold hover:shadow-[0_0_25px_rgba(255,215,0,0.3)] transition-shadow disabled:opacity-60 disabled:cursor-wait"
          >
            {busy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                Verify &amp; Sign in
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 text-sm text-[#888] hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className="w-4 h-4" />
            Resend code
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
