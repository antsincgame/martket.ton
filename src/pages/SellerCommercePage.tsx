import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import { Loader2, Store, Wallet } from 'lucide-react';
import type { CommerceListingPublic } from '../domain/commerce/types';
import { createListing, fetchSellerListings, registerSeller, uploadListingAsset } from '../lib/commerceApi';

const SellerCommercePage = () => {
  const wallet = useTonAddress();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [registered, setRegistered] = useState(false);
  const [listings, setListings] = useState<CommerceListingPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catalogProductId, setCatalogProductId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceTon, setPriceTon] = useState('');
  const [deliveryPayload, setDeliveryPayload] = useState('');
  const [assetListingId, setAssetListingId] = useState('');
  const [assetFile, setAssetFile] = useState<File | null>(null);

  const reloadListings = async (w: string) => {
    const rows = await fetchSellerListings(w);
    setListings(rows);
  };

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    (async () => {
      try {
        await reloadListings(wallet);
      } catch {
        if (!cancelled) setListings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!wallet || !displayName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await registerSeller(wallet, displayName.trim(), bio.trim());
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const onUploadAsset = async (e: FormEvent) => {
    e.preventDefault();
    if (!wallet || !assetListingId.trim() || !assetFile) return;
    setLoading(true);
    setError(null);
    try {
      await uploadListingAsset(assetListingId.trim(), wallet, assetFile);
      setAssetFile(null);
      await reloadListings(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Файл не загружен');
    } finally {
      setLoading(false);
    }
  };

  const onCreateListing = async (e: FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      await createListing({
        sellerWallet: wallet,
        catalogProductId: catalogProductId.trim(),
        title: title.trim(),
        description: description.trim(),
        currency: 'TON',
        jettonMaster: '',
        priceTon: priceTon.trim(),
        decimals: 9,
        deliveryType: 'link',
        deliveryPayload: deliveryPayload.trim(),
        platformFeeBps: 250,
        assetFileId: '',
      });
      setCatalogProductId('');
      setTitle('');
      setDescription('');
      setPriceTon('');
      setDeliveryPayload('');
      await reloadListings(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Листинг не создан');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <Store className="w-10 h-10 text-ton-400" />
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Продажа цифровых товаров</h1>
          <p className="text-gray-400 text-sm">Листинги привязаны к карточкам витрины (catalogProductId).</p>
        </div>
      </div>

      {!wallet && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-2 text-amber-200">
          <Wallet className="w-5 h-5 shrink-0" />
          Подключите кошелёк в шапке, чтобы управлять листингами.
        </div>
      )}

      {wallet && (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Профиль продавца</h2>
            <form onSubmit={onRegister} className="space-y-3">
              <input
                value={displayName}
                onChange={(ev) => setDisplayName(ev.target.value)}
                placeholder="Отображаемое имя"
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
              <textarea
                value={bio}
                onChange={(ev) => setBio(ev.target.value)}
                placeholder="Кратко о себе (необязательно)"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
              <button
                type="submit"
                disabled={loading || !displayName.trim()}
                className="px-4 py-2 rounded-lg bg-ton-gradient font-medium disabled:opacity-50"
              >
                {registered ? 'Обновить регистрацию' : 'Зарегистрироваться'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Новый листинг</h2>
            <form onSubmit={onCreateListing} className="space-y-3">
              <input
                value={catalogProductId}
                onChange={(ev) => setCatalogProductId(ev.target.value)}
                placeholder="catalogProductId (например 1)"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white font-mono text-sm"
              />
              <input
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                placeholder="Заголовок"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
              <textarea
                value={description}
                onChange={(ev) => setDescription(ev.target.value)}
                placeholder="Описание"
                rows={3}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
              <input
                value={priceTon}
                onChange={(ev) => setPriceTon(ev.target.value)}
                placeholder="Цена в TON (например 1.5)"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
              <textarea
                value={deliveryPayload}
                onChange={(ev) => setDeliveryPayload(ev.target.value)}
                placeholder="Секрет доставки: ссылка на файл, лицензионный ключ (виден покупателю после оплаты)"
                rows={2}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Создать листинг
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Загрузка файла к листингу</h2>
            <p className="text-xs text-gray-500 mb-3">
              Укажите ID листинга (см. ниже) и файл — сохранится в bucket <code className="font-mono">commerce_assets</code>.
            </p>
            <form onSubmit={onUploadAsset} className="space-y-3">
              <input
                value={assetListingId}
                onChange={(ev) => setAssetListingId(ev.target.value)}
                placeholder="listing document id"
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white font-mono text-sm"
              />
              <input
                type="file"
                onChange={(ev) => setAssetFile(ev.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-300"
              />
              <button
                type="submit"
                disabled={loading || !assetFile || !assetListingId.trim()}
                className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm disabled:opacity-50"
              >
                Загрузить в Storage
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Ваши листинги</h2>
            {listings.length === 0 ? (
              <p className="text-gray-500 text-sm">Пока пусто.</p>
            ) : (
              <ul className="space-y-3">
                {listings.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-white/10 rounded-xl p-3"
                  >
                    <div>
                      <div className="font-medium text-white">{l.title}</div>
                      <div className="text-xs text-gray-400 font-mono">product {l.catalogProductId}</div>
                    </div>
                    <div className="text-ton-400 text-sm">
                      {l.priceTonHuman !== undefined ? `${l.priceTonHuman} TON` : l.priceAmountRaw}{' '}
                      <span className="text-gray-500">· {l.status}</span>
                      {l.id && (
                        <span className="block text-[10px] text-gray-500 font-mono mt-1">id: {l.id}</span>
                      )}
                    </div>
                    <Link
                      to={`/product/${l.catalogProductId}`}
                      className="text-sm text-purple-300 hover:text-purple-200"
                    >
                      Страница товара →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="mt-6 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">{error}</div>
      )}
    </div>
  );
};

export default SellerCommercePage;
