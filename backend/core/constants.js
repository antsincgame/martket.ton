// Идентификаторы единой БД Appwrite (database core) для профилей, legacy API и аудита.
'use strict';

const CORE_DATABASE_ID = 'core';
const COL_PROFILES = 'profiles';
const COL_DEVELOPERS = 'developers';
const COL_LEGACY_PRODUCTS = 'legacy_products';
const COL_AUDIT_LOGS = 'api_audit_logs';
const BUCKET_TONFORGE_STATE = 'tonforge_state';
const TONFORGE_STATE_FILE_ID = 'tonforge_state_json';

module.exports = {
  CORE_DATABASE_ID,
  COL_PROFILES,
  COL_DEVELOPERS,
  COL_LEGACY_PRODUCTS,
  COL_AUDIT_LOGS,
  BUCKET_TONFORGE_STATE,
  TONFORGE_STATE_FILE_ID,
};
