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
  findUserByClerkId,
  listUsers,
  countUsers,
  updateProfile,
  upsertProfileForClerkUser,
  upsertProfileForAppwriteUser,
} from './profileRepository.js';

export {
  productToSnakeCase,
  listProductsByStatus,
  listAllProducts,
  listProductsByCreator,
  findProductById,
  insertProduct,
  updateProduct,
} from './productRepository.js';

export {
  findPurchase,
  listPurchasesByUser,
  insertPurchase,
} from './purchaseRepository.js';

export {
  insertAuditLog,
  listAuditLogs,
} from './auditRepository.js';

export { generateId } from './generateId.js';
