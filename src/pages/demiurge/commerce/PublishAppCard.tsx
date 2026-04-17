// PublishAppCard — выделено из SellerCommercePage. Использует последний
// успешный artifact scan (передаётся из CommerceSection) и публикует
// приложение через TonForge canonical API.
import { Loader2, Rocket } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TonForgeArtifactScan } from '../../../domain/tonforge/types';
import { publishTonForgeApp } from '../../../services/tonforgeApi';

const publishSchema = z.object({
  catalogProductId: z.string().min(1, 'ID товара из каталога'),
  slug: z.string().min(3, 'Минимум 3 символа'),
  name: z.string().min(3, 'Минимум 3 символа'),
  category: z.string().min(3, 'Минимум 3 символа'),
  summary: z.string().min(10, 'Минимум 10 символов').max(280, 'Максимум 280 символов'),
  description: z.string().min(20, 'Минимум 20 символов'),
  priceTon: z.coerce.number().positive('Должно быть > 0'),
  version: z.string().min(1),
  sizeLabel: z.string().min(2),
  developerSignature: z.string().min(10, 'Подпись слишком короткая'),
  platforms: z.string().min(2, 'Перечислите через запятую'),
  licenseType: z.enum(['SBT', 'Transferable']),
  transferLimit: z.coerce.number().min(0).max(10),
  activationPolicy: z.string().min(3),
});

type PublishFormValues = z.infer<typeof publishSchema>;

interface PublishAppCardProps {
  wallet: string;
  lastScan: TonForgeArtifactScan | null;
  onPublished: () => Promise<void> | void;
  setFlash: (next: { error: string | null; success: string | null }) => void;
}

function normalizePlatforms(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PublishAppCard({ wallet, lastScan, onPublished, setFlash }: PublishAppCardProps) {
  const form = useForm<PublishFormValues>({
    resolver: zodResolver(publishSchema),
    defaultValues: {
      catalogProductId: '',
      slug: '',
      name: '',
      category: 'developer-tools',
      summary: '',
      description: '',
      priceTon: 1,
      version: '1.0.0',
      sizeLabel: '10 MB',
      developerSignature: '',
      platforms: 'Web, Telegram',
      licenseType: 'SBT',
      transferLimit: 0,
      activationPolicy: 'single_device',
    },
  });

  const scanReady = !!lastScan && /pass|clean/i.test(lastScan.status);

  const onSubmit = async (values: PublishFormValues) => {
    if (!lastScan) {
      setFlash({ error: 'Сначала выполните Artifact Scan и дождитесь успешного статуса.', success: null });
      return;
    }
    setFlash({ error: null, success: null });
    try {
      await publishTonForgeApp({
        sellerWallet: wallet,
        catalogProductId: values.catalogProductId,
        slug: values.slug,
        name: values.name,
        category: values.category,
        summary: values.summary,
        description: values.description,
        priceTon: values.priceTon,
        fileName: lastScan.fileName,
        version: values.version,
        sizeLabel: values.sizeLabel,
        artifactUrl: lastScan.artifactUrl,
        sha256: lastScan.sha256,
        developerSignature: values.developerSignature,
        malwareStatus: lastScan.status,
        platforms: normalizePlatforms(values.platforms),
        licenseType: values.licenseType,
        transferLimit: values.transferLimit,
        activationPolicy: values.activationPolicy,
      });
      form.reset();
      setFlash({ success: 'Приложение опубликовано в canonical TonForge API.', error: null });
      await onPublished();
    } catch (e) {
      setFlash({ error: e instanceof Error ? e.message : 'Публикация не удалась', success: null });
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-black/30 p-5">
      <header className="mb-4 flex items-center gap-2">
        <Rocket className="w-5 h-5 text-[#8B5CF6]" aria-hidden />
        <h2 className="text-base font-semibold text-white">Publish App</h2>
        {!scanReady && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-[#FFD700]/70">
            Требуется успешный artifact scan
          </span>
        )}
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-2">
        <Field label="Catalog product ID" error={form.formState.errors.catalogProductId?.message}>
          <input {...form.register('catalogProductId')} className={inputClass} />
        </Field>
        <Field label="Slug" error={form.formState.errors.slug?.message}>
          <input {...form.register('slug')} className={inputClass} placeholder="my-app" />
        </Field>
        <Field label="App name" error={form.formState.errors.name?.message}>
          <input {...form.register('name')} className={inputClass} />
        </Field>
        <Field label="Category" error={form.formState.errors.category?.message}>
          <input {...form.register('category')} className={inputClass} placeholder="developer-tools" />
        </Field>
        <Field label="Цена (TON)" error={form.formState.errors.priceTon?.message}>
          <input type="number" step="0.1" min="0.1" {...form.register('priceTon')} className={inputClass} />
        </Field>
        <Field label="Version" error={form.formState.errors.version?.message}>
          <input {...form.register('version')} className={inputClass} placeholder="1.0.0" />
        </Field>
        <Field label="Size label" error={form.formState.errors.sizeLabel?.message}>
          <input {...form.register('sizeLabel')} className={inputClass} placeholder="10 MB" />
        </Field>
        <Field label="Platforms" error={form.formState.errors.platforms?.message}>
          <input {...form.register('platforms')} className={inputClass} placeholder="Web, Telegram, Windows" />
        </Field>
        <Field label="Developer signature" error={form.formState.errors.developerSignature?.message}>
          <input {...form.register('developerSignature')} className={`${inputClass} font-mono`} />
        </Field>
        <Field label="Activation policy" error={form.formState.errors.activationPolicy?.message}>
          <input {...form.register('activationPolicy')} className={inputClass} placeholder="single_device" />
        </Field>
        <Field label="License type" error={form.formState.errors.licenseType?.message}>
          <select {...form.register('licenseType')} className={inputClass}>
            <option value="SBT">SBT (soul-bound)</option>
            <option value="Transferable">Transferable NFT</option>
          </select>
        </Field>
        <Field label="Transfer limit" error={form.formState.errors.transferLimit?.message}>
          <input type="number" min="0" max="10" {...form.register('transferLimit')} className={inputClass} />
        </Field>
        <Field
          label="Краткое описание (summary)"
          error={form.formState.errors.summary?.message}
          colSpan
        >
          <textarea {...form.register('summary')} rows={2} className={inputClass} maxLength={280} />
        </Field>
        <Field label="Описание" error={form.formState.errors.description?.message} colSpan>
          <textarea {...form.register('description')} rows={4} className={inputClass} />
        </Field>

        <button
          type="submit"
          disabled={form.formState.isSubmitting || !scanReady}
          className="md:col-span-2 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#FF6B6B] text-white font-semibold uppercase tracking-wider px-4 py-3 text-sm disabled:opacity-50"
        >
          {form.formState.isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Опубликовать приложение'
          )}
        </button>
      </form>

      <p className="mt-3 text-xs text-[#666]">
        Публикация использует последний успешный scan и создаёт app metadata с NFT license policy.
      </p>
    </section>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white placeholder-[#555] focus:border-[#8B5CF6]/50 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/30';

function Field({
  label,
  error,
  colSpan,
  children,
}: {
  label: string;
  error?: string;
  colSpan?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${colSpan ? 'md:col-span-2' : ''}`}>
      <span className="block text-[10px] uppercase tracking-wider text-[#666] mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-300 mt-1">{error}</span>}
    </label>
  );
}
