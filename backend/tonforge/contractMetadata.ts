export const contractMetadata = {
  registry: {
    name: 'Registry',
    standard: 'custom',
    responsibility: 'Связывает app_id с адресом AppCollection и seller metadata.',
    trackedEvents: ['app_registered', 'collection_deployed'],
  },
  appCollection: {
    name: 'AppCollection',
    standard: 'TEP-62',
    responsibility: 'Хранит NFT-лицензии конкретного приложения и contract-level metadata.',
    trackedEvents: ['collection_initialized', 'license_minted'],
  },
  licenseNft: {
    name: 'LicenseNFT',
    standard: 'TEP-64',
    responsibility: 'Выступает лицензионным ключом и хранит metadata артефакта и device binding policy.',
    trackedEvents: ['license_activated', 'license_transferred', 'license_burned'],
  },
  escrow: {
    name: 'Escrow',
    standard: 'custom',
    responsibility: 'Удерживает оплату 72 часа и управляет refund/release state machine.',
    trackedEvents: ['escrow_locked', 'trial_started', 'refund_executed', 'release_executed'],
  },
} as const;

export const onChainFields = [
  'app_id',
  'artifact_sha256',
  'developer_signature',
  'license_type',
  'transfer_limit',
  'device_id',
] as const;
