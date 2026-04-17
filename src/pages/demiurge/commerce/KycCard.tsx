// KycCard — выделено из SellerCommercePage. Отправляет developer KYC и
// сообщает родителю об успехе через onSubmitted (для перезагрузки workspace).
import { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TonForgeDeveloperWorkspace } from '../../../domain/tonforge/types';
import { submitDeveloperKyc } from '../../../services/tonforgeApi';

const kycSchema = z.object({
  displayName: z.string().min(2, 'Минимум 2 символа'),
  legalName: z.string().min(2, 'Минимум 2 символа'),
  contactEmail: z.string().email('Некорректный email'),
  country: z.string().min(2).max(2, 'ISO-код страны: 2 буквы'),
  bio: z.string().min(10, 'Минимум 10 символов'),
});

type KycFormValues = z.infer<typeof kycSchema>;

interface KycCardProps {
  wallet: string;
  workspace: TonForgeDeveloperWorkspace | null;
  onSubmitted: () => Promise<void> | void;
  setFlash: (next: { error: string | null; success: string | null }) => void;
}

export default function KycCard({ wallet, workspace, onSubmitted, setFlash }: KycCardProps) {
  const form = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      displayName: workspace?.developer.displayName ?? '',
      legalName: workspace?.developer.legalName ?? '',
      contactEmail: workspace?.developer.contactEmail ?? '',
      country: workspace?.developer.country ?? 'EE',
      bio: workspace?.developer.bio ?? '',
    },
  });

  useEffect(() => {
    if (!workspace) return;
    form.reset({
      displayName: workspace.developer.displayName,
      legalName: workspace.developer.legalName,
      contactEmail: workspace.developer.contactEmail,
      country: workspace.developer.country,
      bio: workspace.developer.bio,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.developer.wallet]);

  const onSubmit = async (values: KycFormValues) => {
    setFlash({ error: null, success: null });
    try {
      await submitDeveloperKyc({ wallet, ...values });
      setFlash({ success: 'KYC-анкета отправлена на проверку модерации.', error: null });
      await onSubmitted();
    } catch (e) {
      setFlash({ error: e instanceof Error ? e.message : 'KYC не отправлен', success: null });
    }
  };

  const status = workspace?.developer.kycStatus;
  const badge = workspace?.developer.sellerBadge;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-black/30 p-5">
      <header className="mb-4 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#00FF88]" aria-hidden />
        <h2 className="text-base font-semibold text-white">Developer KYC</h2>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <Field label="Display name" error={form.formState.errors.displayName?.message}>
          <input
            {...form.register('displayName')}
            className={inputClass}
            placeholder="Мастерская Гермеса"
          />
        </Field>
        <Field label="Legal entity" error={form.formState.errors.legalName?.message}>
          <input {...form.register('legalName')} className={inputClass} placeholder="OÜ TonForge Studio" />
        </Field>
        <Field label="Contact email" error={form.formState.errors.contactEmail?.message}>
          <input
            type="email"
            {...form.register('contactEmail')}
            className={inputClass}
            placeholder="hello@example.com"
          />
        </Field>
        <Field label="Country (ISO-2)" error={form.formState.errors.country?.message}>
          <input
            {...form.register('country')}
            className={`${inputClass} uppercase`}
            placeholder="EE"
            maxLength={2}
          />
        </Field>
        <Field label="Чем вы занимаетесь" error={form.formState.errors.bio?.message}>
          <textarea
            {...form.register('bio')}
            rows={3}
            className={inputClass}
            placeholder="Кратко: какие приложения публикуете, кто пользователи."
          />
        </Field>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0A0A0A] font-semibold uppercase tracking-wider px-4 py-2 text-sm disabled:opacity-50"
        >
          {form.formState.isSubmitting ? 'Отправка…' : 'Отправить KYC'}
        </button>
      </form>

      {workspace && (
        <p className="mt-3 text-xs text-[#888]">
          Статус: <span className="text-white">{status}</span>
          {badge ? <> · бейдж <span className="text-white">{badge}</span></> : null}
        </p>
      )}
    </section>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white placeholder-[#555] focus:border-[#FFD700]/50 focus:outline-none focus:ring-1 focus:ring-[#FFD700]/30';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-[#666] mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-300 mt-1">{error}</span>}
    </label>
  );
}
