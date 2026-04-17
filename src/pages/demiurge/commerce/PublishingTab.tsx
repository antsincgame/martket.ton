// PublishingTab — собирает воркфлоу выпуска приложения: KYC, Artifact Scan,
// Publish App. Каждая карточка — самостоятельный компонент; общий error/success
// и lastScan живут в CommerceSection, чтобы шаги могли передавать друг другу
// данные между навигациями.
import type { TonForgeArtifactScan, TonForgeDeveloperWorkspace } from '../../../domain/tonforge/types';
import KycCard from './KycCard';
import ArtifactScanCard from './ArtifactScanCard';
import PublishAppCard from './PublishAppCard';

interface PublishingTabProps {
  wallet: string;
  workspace: TonForgeDeveloperWorkspace | null;
  lastScan: TonForgeArtifactScan | null;
  setLastScan: (next: TonForgeArtifactScan | null) => void;
  onWorkspaceChanged: () => Promise<void> | void;
  setFlash: (next: { error: string | null; success: string | null }) => void;
}

export default function PublishingTab({
  wallet,
  workspace,
  lastScan,
  setLastScan,
  onWorkspaceChanged,
  setFlash,
}: PublishingTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <KycCard
          wallet={wallet}
          workspace={workspace}
          onSubmitted={onWorkspaceChanged}
          setFlash={setFlash}
        />
        <ArtifactScanCard lastScan={lastScan} setLastScan={setLastScan} setFlash={setFlash} />
      </div>

      <PublishAppCard
        wallet={wallet}
        lastScan={lastScan}
        onPublished={onWorkspaceChanged}
        setFlash={setFlash}
      />
    </div>
  );
}
