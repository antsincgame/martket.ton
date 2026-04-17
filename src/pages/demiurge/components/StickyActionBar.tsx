import { memo } from 'react';
import { Loader2, Save, X } from 'lucide-react';

interface StickyActionBarProps {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  /** Optional message — e.g. "3 unsaved changes". */
  message?: string;
}

/**
 * Floating action bar for forms — pinned to the bottom of the viewport
 * (above the mobile nav tab bar) when the form is dirty. Mirrors the
 * UX of App Store Connect / Play Console editors.
 */
const StickyActionBar = memo(({
  visible,
  saving,
  onSave,
  onCancel,
  saveLabel = 'Save changes',
  cancelLabel = 'Discard',
  message,
}: StickyActionBarProps) => {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-hidden={!visible}
      className={`fixed left-0 right-0 z-30 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      style={{
        bottom: 'max(0px, env(safe-area-inset-bottom))',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)',
      }}
    >
      <div className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-3 lg:pb-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#FFD700]/25 bg-[#0F0F18]/95 backdrop-blur-xl px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            <div className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse shadow-[0_0_8px_rgba(255,215,0,0.6)]" aria-hidden />
            <p className="text-sm text-white flex-1 truncate">
              {message || 'You have unsaved changes'}
            </p>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[#999] hover:text-white text-xs font-semibold transition-colors disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg bg-[#FFD700] text-[#0A0A0A] text-xs font-semibold uppercase tracking-widest hover:shadow-[0_0_24px_rgba(255,215,0,0.45)] transition-shadow disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <Save className="w-4 h-4" aria-hidden />
              )}
              <span>{saving ? 'Saving…' : saveLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

StickyActionBar.displayName = 'StickyActionBar';

export default StickyActionBar;
