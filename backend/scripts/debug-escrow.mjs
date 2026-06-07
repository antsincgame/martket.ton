/** Quick check: computeEscrow returns address + stateInit for testnet buyer. */
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(backendDir, '.env') });

const { computeEscrow } = await import('../commerce/escrow.ts');

const result = await computeEscrow({
  orderId: '6a25d260001fe70e0ac0',
  buyer: '0QCcZCSkjRaVKwj90kHQ0YLGnu7MxNDDL3Go3OrFudDsI_9Y',
  seller: 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t',
  treasury: '0QDLSgMKoLoiRedbweIoescZpf2xUp3op4mw527zVWOoFiBR',
  amountNano: '209090909',
  sellerAmountNano: '181818182',
  feeNano: '27272727',
  trialWindowSec: 259200,
  collectionAddress: 'kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-',
  licenseContentUri: 'https://cdn.example.org/license/test.json',
});

console.log(JSON.stringify(result, null, 2));
