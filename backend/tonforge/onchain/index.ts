export { loadOnchainConfig, type OnchainConfig } from './config.js';
export { getTonClient, getLicenseItemCode, getAppCollectionCode } from './tonClient.js';
export { getOracleWallet, getOracleAddressString } from './oracleWallet.js';
export { mintLicense, pollItemDeployed, type MintLicenseInput, type MintLicenseResult } from './mintLicense.js';
export { registerLicense, type RegisterLicenseInput, type RegisterLicenseResult } from './registerLicense.js';
export {
  pollEscrowSettled,
  type PollEscrowSettledOpts,
} from './oracleRefund.js';
export {
  timeoutRelease,
  checkEscrowAlive,
  type TimeoutReleaseInput,
  type TimeoutReleaseResult,
} from './timeoutRelease.js';
export { verifyLicenseOwner, type OwnershipResult } from './verifyOwnership.js';
export {
  buildOffchainContent,
  buildIndividualContent,
  computeItemAddress,
  computeCollectionAddress,
  collectionStateInit,
  buildMintLicensePayload,
  buildRegisterLicensePayload,
  buildPayEscrowPayload,
  buildConfirmDeliveryPayload,
  buildTimeoutReleasePayload,
  OP,
  type AppCollectionInit,
  type LicenseItemInit,
} from './contractSchemas.js';
