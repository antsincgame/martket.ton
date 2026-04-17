/**
 * Barrel re-export — backward compatibility.
 * New code should import from specific repositories directly.
 */
export {
  profileToSnakeCase,
  findUserByTonAddress,
  findUserById,
  findUserByAppwriteId,
  findUserByEmail,
  findProfileBySlug,
  listUsers,
  countUsers,
  updateProfile,
  upsertProfileForAppwriteUser,
} from './profileRepository.js';

export {
  productToSnakeCase,
  listProductsByStatus,
  listAllProducts,
  listProductsByCreator,
  findProductById,
  searchProducts,
  insertProduct,
  updateProduct,
  updateScanResult,
} from './productRepository.js';

export {
  findPurchase,
  findPurchaseByTxHash,
  listPurchasesByUser,
  insertPurchase,
} from './purchaseRepository.js';

export {
  insertAuditLog,
  listAuditLogs,
} from './auditRepository.js';

export { generateId } from './generateId.js';
