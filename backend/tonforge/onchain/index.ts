export { loadOnchainConfig, type OnchainConfig } from './config.js';
export { getTonClient, getLicenseItemCode, getAppCollectionCode } from './tonClient.js';
export { getOracleWallet, getOracleAddressString } from './oracleWallet.js';
export { mintLicense, pollItemDeployed, type MintLicenseInput, type MintLicenseResult } from './mintLicense.js';
export { burnLicense, pollItemBurned, type BurnLicenseInput, type BurnLicenseResult } from './burnLicense.js';
export { registerLicense, type RegisterLicenseInput, type RegisterLicenseResult } from './registerLicense.js';
export { verifyLicenseOwner, type OwnershipResult } from './verifyOwnership.js';
export {
  buildOffchainContent,
  buildIndividualContent,
  computeItemAddress,
  computeCollectionAddress,
  collectionStateInit,
  buildMintLicensePayload,
  buildBurnLicensePayload,
  buildRegisterLicensePayload,
  OP,
  type AppCollectionInit,
  type LicenseItemInit,
} from './contractSchemas.js';
