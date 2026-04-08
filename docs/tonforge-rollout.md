<!-- Rollout guide нужен, чтобы новая TonForge реализация последовательно переехала с demo-state на PostgreSQL и реальные TON contracts. -->
# TonForge Rollout

## Canonical Order
1. Применить `backend/sql/tonforge_schema.sql` к PostgreSQL или Supabase Postgres.
2. Заменить in-memory state в `backend/tonforge/service.js` на repository, читающий эти таблицы.
3. Подключить реальный wallet challenge/verification вместо demo confirm в `/api/tonforge/purchase/confirm`.
4. Привязать contract event ingestion для `Registry`, `AppCollection`, `LicenseNFT` и `Escrow`.
5. После стабилизации удалить legacy `deliveryPayload` commerce flow.

## Required Checks
- `npm run typecheck`
- `npm run build`
- `node --test "backend/tests/**/*.test.js"`
- smoke-test страниц:
  - `/developer`
  - `/developer/register`
  - `/seller/commerce`
  - `/profile`
  - `/product/:id`

## Critical Runtime Scenarios
- Разработчик проходит KYC и публикует приложение после successful artifact scan.
- Покупатель создаёт purchase session и получает NFT license.
- Покупатель привязывает `device_id` и видит binding в профиле.
- Покупатель открывает dispute до окончания trial.
- Разработчик видит contract readiness и опубликованные приложения в dashboard.

## Replace Demo With Production
- `backend/tonforge/demoData.js` заменить на Postgres repository.
- `backend/tonforge/router.js` сохранить как HTTP boundary, меняется только service/repository.
- `src/services/tonforgeApi.ts` не менять: фронт уже привязан к каноническим endpoint contracts.
