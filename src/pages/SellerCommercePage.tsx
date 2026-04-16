// Страница продавца пересобрана в publisher console с KYC, artifact scan и публикацией NFT-лицензируемых приложений TonForge.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import { slugify } from '../utils/slugify';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Loader2, ShieldCheck, Store, Wallet, FileScan, Rocket } from 'lucide-react';
import type { TonForgeApp, TonForgeArtifactScan, TonForgeDeveloperWorkspace } from '../domain/tonforge/types';
import {
  fetchDeveloperWorkspace,
  publishTonForgeApp,
  runArtifactScan,
  submitDeveloperKyc,
} from '../services/tonforgeApi';

const kycSchema = z.object({
  displayName: z.string().min(2),
  legalName: z.string().min(2),
  contactEmail: z.string().email(),
  country: z.string().min(2).max(2),
  bio: z.string().min(10),
});

const scanSchema = z.object({
  fileName: z.string().min(3),
  artifactUrl: z.string().url(),
  sha256: z.string().length(64),
});

const publishSchema = z.object({
  catalogProductId: z.string().min(1),
  slug: z.string().min(3),
  name: z.string().min(3),
  category: z.string().min(3),
  summary: z.string().min(10),
  description: z.string().min(20),
  priceTon: z.coerce.number().positive(),
  version: z.string().min(1),
  sizeLabel: z.string().min(2),
  developerSignature: z.string().min(10),
  platforms: z.string().min(2),
  licenseType: z.enum(['SBT', 'Transferable']),
  transferLimit: z.coerce.number().min(0).max(10),
  activationPolicy: z.string().min(3),
});

type KycFormValues = z.infer<typeof kycSchema>;
type ScanFormValues = z.infer<typeof scanSchema>;
type PublishFormValues = z.infer<typeof publishSchema>;

function normalizePlatforms(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const SellerCommercePage = () => {
  const wallet = useTonAddress();
  const [workspace, setWorkspace] = useState<TonForgeDeveloperWorkspace | null>(null);
  const [lastScan, setLastScan] = useState<TonForgeArtifactScan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const kycForm = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      displayName: '',
      legalName: '',
      contactEmail: '',
      country: 'EE',
      bio: '',
    },
  });
  const scanForm = useForm<ScanFormValues>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      fileName: '',
      artifactUrl: '',
      sha256: '',
    },
  });
  const publishForm = useForm<PublishFormValues>({
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

  const loadWorkspace = async (nextWallet: string) => {
    const data = await fetchDeveloperWorkspace(nextWallet);
    setWorkspace(data);
    kycForm.reset({
      displayName: data.developer.displayName,
      legalName: data.developer.legalName,
      contactEmail: data.developer.contactEmail,
      country: data.developer.country,
      bio: data.developer.bio,
    });
  };

  useEffect(() => {
    if (!wallet) {
      setWorkspace(null);
      return;
    }

    let cancelled = false;
    void loadWorkspace(wallet).catch((reason: unknown) => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить publisher workspace');
    });

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const onSubmitKyc = async (values: KycFormValues) => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await submitDeveloperKyc({ wallet, ...values });
      await loadWorkspace(wallet);
      setSuccess('KYC-анкета отправлена на проверку модерации.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'KYC не отправлен');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitScan = async (values: ScanFormValues) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const scan = await runArtifactScan(values);
      setLastScan(scan);
      setSuccess('Артефакт успешно проверен. Можно публиковать приложение.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Artifact scan завершился ошибкой');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitPublish = async (values: PublishFormValues) => {
    if (!wallet || !lastScan) {
      setError('Сначала выполните artifact scan и дождитесь статуса passed.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
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
      publishForm.reset();
      await loadWorkspace(wallet);
      setSuccess('Приложение опубликовано в canonical TonForge API.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Публикация не удалась');
    } finally {
      setLoading(false);
    }
  };

  const publishedApps: TonForgeApp[] = workspace?.apps ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Store className="h-10 w-10 text-ton-400" />
        <div>
          <h1 className="text-3xl font-display font-bold text-white">TonForge Publisher Console</h1>
          <p className="text-sm text-gray-400">KYC, artifact scan, NFT licensing и публикация приложений в одном потоке.</p>
        </div>
      </div>

      {!wallet && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <Wallet className="h-5 w-5 shrink-0" />
          Подключите кошелёк, чтобы открыть publisher workspace.
        </div>
      )}

      {wallet && (
        <div className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex items-center gap-2 text-white">
                <ShieldCheck className="h-5 w-5 text-green-400" />
                <h2 className="text-lg font-semibold">Developer KYC</h2>
              </div>
              <form onSubmit={kycForm.handleSubmit(onSubmitKyc)} className="space-y-3">
                <input {...kycForm.register('displayName')} placeholder="Display name" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
                <input {...kycForm.register('legalName')} placeholder="Legal entity" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
                <input {...kycForm.register('contactEmail')} placeholder="Contact email" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
                <input {...kycForm.register('country')} placeholder="Country code" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white uppercase" />
                <textarea {...kycForm.register('bio')} placeholder="Что вы публикуете в TonForge" rows={3} className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
                <button type="submit" disabled={loading} className="rounded-lg bg-ton-gradient px-4 py-2 font-medium text-white disabled:opacity-50">
                  {loading ? 'Отправка...' : 'Отправить KYC'}
                </button>
              </form>
              {workspace && (
                <p className="mt-3 text-sm text-gray-400">
                  Текущий статус: <span className="text-white">{workspace.developer.kycStatus}</span> · бейдж{' '}
                  <span className="text-white">{workspace.developer.sellerBadge}</span>
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex items-center gap-2 text-white">
                <FileScan className="h-5 w-5 text-cyan-300" />
                <h2 className="text-lg font-semibold">Artifact Scan</h2>
              </div>
              <form onSubmit={scanForm.handleSubmit(onSubmitScan)} className="space-y-3">
                <input {...scanForm.register('fileName')} placeholder="artifact.zip" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
                <input {...scanForm.register('artifactUrl')} placeholder="https://downloads.example/app.zip" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
                <input {...scanForm.register('sha256')} placeholder="64-char sha256" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-mono text-white" />
                <button type="submit" disabled={loading} className="rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white disabled:opacity-50">
                  {loading ? 'Сканирование...' : 'Проверить артефакт'}
                </button>
              </form>
              {lastScan && (
                <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">
                  <p>Статус: {lastScan.status}</p>
                  <p>Fingerprint: {lastScan.integrityFingerprint.slice(0, 18)}...</p>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Rocket className="h-5 w-5 text-purple-300" />
              <h2 className="text-lg font-semibold">Publish App</h2>
            </div>
            <form onSubmit={publishForm.handleSubmit(onSubmitPublish)} className="grid gap-3 md:grid-cols-2">
              <input {...publishForm.register('catalogProductId')} placeholder="catalogProductId" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input {...publishForm.register('slug')} placeholder="slug" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input {...publishForm.register('name')} placeholder="App name" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input {...publishForm.register('category')} placeholder="Category" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input type="number" step="0.1" {...publishForm.register('priceTon')} placeholder="Price TON" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input {...publishForm.register('version')} placeholder="Version" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input {...publishForm.register('sizeLabel')} placeholder="Size label" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input {...publishForm.register('platforms')} placeholder="Web, Telegram, Windows" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input {...publishForm.register('developerSignature')} placeholder="Developer signature" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <input {...publishForm.register('activationPolicy')} placeholder="single_device" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <select {...publishForm.register('licenseType')} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-white">
                <option value="SBT">SBT</option>
                <option value="Transferable">Transferable</option>
              </select>
              <input type="number" {...publishForm.register('transferLimit')} placeholder="Transfer limit" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <textarea {...publishForm.register('summary')} placeholder="Короткое summary" rows={2} className="md:col-span-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <textarea {...publishForm.register('description')} placeholder="Подробное описание продукта" rows={4} className="md:col-span-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white" />
              <button type="submit" disabled={loading} className="md:col-span-2 rounded-lg bg-purple-600 px-4 py-3 font-medium text-white disabled:opacity-50">
                {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Опубликовать приложение'}
              </button>
            </form>
            <p className="mt-3 text-sm text-gray-400">
              Публикация использует последний успешный scan и создает app metadata с NFT license policy.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Published Apps</h2>
            {publishedApps.length === 0 ? (
              <p className="text-sm text-gray-500">Пока нет опубликованных приложений.</p>
            ) : (
              <ul className="space-y-3">
                {publishedApps.map((app) => (
                  <li key={app.appId} className="flex flex-col gap-2 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-white">{app.name}</div>
                      <div className="text-xs text-gray-400">
                        {app.category} · {app.priceTon} TON · {app.license.type}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-cyan-300">{app.artifact.malwareStatus}</span>
                      <span className="text-gray-500">{app.license.contractStatus}</span>
                      <Link to={`/product/${slugify(app.name)}`} className="text-purple-300 hover:text-purple-200">
                        Открыть страницу →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {error && <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {success && <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{success}</div>}
    </div>
  );
};

export default SellerCommercePage;
