// Warns the seller about active commerce listings without a deployed
// AppCollection. After the NFT-mint bridge such listings cannot accept
// new purchases (orderRoutes.confirm throws LISTING_NO_COLLECTION),
// and the migration script will eventually move them to `suspended`.
//
// We surface them BEFORE that happens so the seller has a chance to
// deploy a collection and avoid downtime.
import { useEffect, useState } from 'react';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import { fetchSellerListings } from '../../../lib/commerceApi';
import type { CommerceListingPublic } from '../../../domain/commerce/types';
import { logger } from '../../../lib/logger';

interface Props {
  wallet: string;
}

export default function NoCollectionWarning({ wallet }: Props) {
  const [orphans, setOrphans] = useState<CommerceListingPublic[]>([]);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    fetchSellerListings(wallet)
      .then((listings) => {
        if (cancelled) return;
        const bad = listings.filter(
          (l) => l.status === 'active' && !(l.collectionAddress && l.collectionAddress.trim()),
        );
        setOrphans(bad);
      })
      .catch((err) => logger.warn('[NoCollectionWarning] fetchSellerListings', err));
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (orphans.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-amber-100">
            {orphans.length === 1
              ? '1 active listing has no NFT collection'
              : `${orphans.length} active listings have no NFT collection`}
          </p>
          <p className="text-amber-100/80 text-xs leading-relaxed">
            Buyers cannot complete purchases on these listings — the License NFT mint
            cannot start without a deployed <code className="font-mono">AppCollection</code>.
            Deploy a collection (see the runbook) and update the listing with its address,
            otherwise it will be auto-suspended in the next maintenance window.
          </p>
          <a
            href="https://github.com/antsincgame/martket.ton/blob/main/docs/license-nft-runbook.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 hover:text-amber-100 underline"
          >
            <ExternalLink className="w-3 h-3" aria-hidden /> Deploy collection runbook
          </a>
        </div>
      </div>
      <ul className="space-y-1 pl-8">
        {orphans.map((l) => (
          <li key={l.id} className="text-[11px] font-mono text-amber-200/90 break-all">
            {l.title || l.catalogProductId || l.id} — listing {l.id}
          </li>
        ))}
      </ul>
    </div>
  );
}
