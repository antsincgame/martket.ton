/**
 * Генерация COLLECTION_OWNER testnet-кошелька (WalletContractV4, workchain 0).
 */
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

const mnemonic = await mnemonicNew();
const keyPair = await mnemonicToPrivateKey(mnemonic);
const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
const address = wallet.address.toString({ testOnly: true, bounceable: false });

console.log(`COLLECTION_OWNER_MNEMONIC_TESTNET="${mnemonic.join(' ')}"`);
console.log(`COLLECTION_OWNER_ADDRESS_TESTNET="${address}"`);
