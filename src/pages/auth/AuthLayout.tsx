import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Gem } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * Auth pages layout — full-screen, slightly darker than the homepage
 * (`from-[#030308]` vs the homepage's near-black) with a centered card.
 *
 * Uses the same brand language as the rest of the app: Orbitron for the
 * wordmark, golden Gem icon, ton-gradient accent.
 */
export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="relative min-h-[calc(100vh-12rem)] -mx-4 -my-8 flex items-center justify-center overflow-hidden">
      {/* Background: layered radial gradients for depth without runtime cost. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-[#030308] via-[#08081A] to-[#030308]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(255,215,0,0.08), transparent 40%), radial-gradient(circle at 85% 80%, rgba(0,245,255,0.06), transparent 45%), radial-gradient(circle at 50% 50%, rgba(155,93,229,0.04), transparent 50%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.6)_100%)]"
      />

      {/* Card */}
      <div className="relative w-full max-w-md mx-4 my-8">
        <Link
          to="/"
          className="flex flex-col items-center gap-3 mb-8 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-ton-gradient flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.25)] group-hover:shadow-[0_0_45px_rgba(255,215,0,0.4)] transition-shadow">
            <Gem className="w-7 h-7 text-[#0A0A0A]" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold uppercase tracking-[0.2em] text-white">
              TON Web Store
            </h1>
            <p className="text-xs text-[#888] mt-1 tracking-widest uppercase">
              Enter the Digital Sanctum
            </p>
          </div>
        </Link>

        <div className="rounded-3xl border border-[#FFD700]/15 bg-[#0A0A18]/85 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(255,215,0,0.05)]">
          {(title || subtitle) && (
            <div className="text-center mb-6">
              {title && (
                <h2 className="text-xl font-display text-white mb-2">{title}</h2>
              )}
              {subtitle && (
                <p className="text-sm text-[#888]">{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </div>

        <p className="text-center text-xs text-[#555] mt-6">
          By continuing you agree to the{' '}
          <Link to="/terms" className="text-[#888] hover:text-[#FFD700] underline-offset-2 hover:underline">
            Terms
          </Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-[#888] hover:text-[#FFD700] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
