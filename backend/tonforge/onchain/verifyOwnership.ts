import { Address } from '@ton/core';
import { logger } from '../../logger.js';
import { getTonClient } from './tonClient.js';

export interface OwnershipResult {
  ok: boolean;
  reason?: string;
  ownerOnchain?: string;
  ownerExpected?: string;
  index?: string;
  collection?: string;
}

/**
 * Verify that `expectedOwner` is the current TEP-64 owner of the License NFT
 * deployed at `nftAddress`. Returns ok=false if the contract doesn't exist
 * (burned), if get_nft_data fails, or if owner mismatches.
 */
export async function verifyLicenseOwner(
  nftAddress: string,
  expectedOwner: string,
): Promise<OwnershipResult> {
  let nftAddr: Address;
  let expectedAddr: Address;
  try {
    nftAddr = Address.parse(nftAddress);
    expectedAddr = Address.parse(expectedOwner);
  } catch (err) {
    return { ok: false, reason: 'INVALID_ADDRESS' };
  }

  const client = getTonClient();

  // Existence check first — burned NFTs return active=false here.
  let isActive = false;
  try {
    const state = await client.getContractState(nftAddr);
    isActive = state.state === 'active';
  } catch (err) {
    logger.warn('[onchain.verify] getContractState failed:', err);
    return { ok: false, reason: 'CONTRACT_LOOKUP_FAILED' };
  }
  if (!isActive) {
    return { ok: false, reason: 'NFT_NOT_DEPLOYED_OR_BURNED' };
  }

  try {
    const result = await client.runMethod(nftAddr, 'get_nft_data');
    const init = result.stack.readBoolean();
    const index = result.stack.readBigNumber();
    const collection = result.stack.readAddress();
    const owner = result.stack.readAddress();
    if (!init) {
      return { ok: false, reason: 'NFT_NOT_INITIALIZED' };
    }
    const matches = owner.equals(expectedAddr);
    return {
      ok: matches,
      reason: matches ? undefined : 'OWNER_MISMATCH',
      ownerOnchain: owner.toString(),
      ownerExpected: expectedAddr.toString(),
      index: index.toString(),
      collection: collection.toString(),
    };
  } catch (err) {
    logger.warn('[onchain.verify] runMethod get_nft_data failed:', err);
    return { ok: false, reason: 'GET_NFT_DATA_FAILED' };
  }
}
