/**
 * Централизованные лимиты для читаемых URL (ЧПУ) и UX.
 * Используются на фронте (input maxLength, валидация) и должны совпадать
 * с Zod-схемами на backend (backend/routes/validation.ts).
 */
export const PRODUCT_NAME_MIN = 3;
export const PRODUCT_NAME_MAX = 60;

export const DEVELOPER_DISPLAY_NAME_MIN = 2;
export const DEVELOPER_DISPLAY_NAME_MAX = 40;

export const DEVELOPER_SLUG_MAX = 40;
