#!/usr/bin/env bash
# TonForge Agent API — curl quickstart.
#   TONFORGE_AGENT_TOKEN=tfa_... ./quickstart.sh
set -euo pipefail

: "${TONFORGE_AGENT_TOKEN:?Set TONFORGE_AGENT_TOKEN}"
API="${TONFORGE_API:-https://tonforge.org/api/v1/agent}"
AUTH=(-H "Authorization: Bearer ${TONFORGE_AGENT_TOKEN}")

echo "# identity"
curl -fsS "$API/me" "${AUTH[@]}" | jq

echo "# listings"
curl -fsS "$API/listings" "${AUTH[@]}" | jq '.data.listings'

echo "# latest orders"
curl -fsS "$API/orders?limit=10" "${AUTH[@]}" | jq '.data.orders'

# Uncomment to create a listing:
# curl -fsS -X POST "$API/listings" "${AUTH[@]}" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "sellerWallet": "EQC…",
#     "catalogProductId": "prod_123",
#     "title": "My digital good",
#     "priceUsd": 9.99,
#     "deliveryType": "file",
#     "deliveryPayload": "https://example.com/secret",
#     "collectionAddress": "EQC…collection"
#   }' | jq '.data.listing'
