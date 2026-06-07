import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(backendDir, '.env.staging'), override: true });
dotenv.config({ path: join(backendDir, '.env'), override: true });

const { Address } = await import('@ton/core');
const mod = await import('../commerce/collectionProvisioner.ts');
const seller = 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t';
const ownerStr = process.env.COLLECTION_OWNER_ADDRESS_TESTNET || '';
console.log('owner env:', ownerStr);
const owner = Address.parse(ownerStr);
console.log('owner parsed:', owner.toString({ testOnly: true, bounceable: false }));

const appId = mod.deriveAppId(seller, 'testnet');
console.log('appId:', appId.toString());

const { metadataUri, itemBaseUri } = mod.buildSellerMetadataUris(seller, 'testnet');
console.log('meta:', metadataUri);

const { address, init } = await mod.computeCollectionInit(appId, owner, metadataUri, itemBaseUri);
console.log('collection testnet:', address.toString({ testOnly: true, bounceable: false }));
console.log('collection mainnet:', address.toString({ testOnly: false }));

try {
  const result = await mod.provisionSellerCollection(seller, 'testnet');
  console.log('provision OK:', result);
} catch (e) {
  console.error('provision FAIL:', e);
}
