// Страница регистрации разработчика теперь ведёт в единый TonForge publisher onboarding вместо legacy Supabase-only сценария.
import { Link } from 'react-router-dom';
import { useTonAddress, TonConnectButton } from '@tonconnect/ui-react';
import { ArrowRight, Gem, ShieldCheck, Sparkles } from 'lucide-react';

const DeveloperRegister = () => {
  const tonAddress = useTonAddress();

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ton-gradient">
                <Gem className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -right-2 -top-2 text-yellow-400">
                <Sparkles className="h-8 w-8" />
              </div>
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-3xl font-bold text-transparent">
            Publish on TonForge
          </h1>
          <p className="mt-4 text-gray-300">
            Единый onboarding для KYC, artifact scan, NFT license policy и публикации приложений на TON.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-lg">
          <div className="mb-8 flex justify-center">
            <TonConnectButton />
          </div>

          {tonAddress ? (
            <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
              Подключён кошелёк: {tonAddress.slice(0, 6)}...{tonAddress.slice(-4)}
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
              Сначала подключите кошелёк. Он станет developer identity для publisher workspace.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 font-semibold text-white">1. KYC</div>
              <p className="text-sm text-gray-400">Подтверждение разработчика и seller badge до публикации.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 font-semibold text-white">2. Artifact scan</div>
              <p className="text-sm text-gray-400">SHA-256 и anti-malware проверка перед публикацией.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 font-semibold text-white">3. NFT license</div>
              <p className="text-sm text-gray-400">Escrow, trial и device binding на базе TonForge API.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/seller/commerce"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-ton-gradient px-6 py-3 font-semibold text-white"
            >
              Открыть Publisher Console
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/developer"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white"
            >
              Перейти в Developer Dashboard
            </Link>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <p>
              Новый onboarding не зависит от старой Supabase-only регистрации. Источник developer identity теперь wallet + TonForge canonical API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperRegister;
