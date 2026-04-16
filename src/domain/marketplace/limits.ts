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

/** Короткая строка «About» под именем — как Twitter bio. */
export const BIO_MAX = 160;

/**
 * Манифест (About detailed) — длинный текст на профиле.
 * 2000 символов ≈ 300-400 слов — достаточно для storytelling,
 * но коротко для overlay'я на баннере (best practice: GitHub ~160k, Steam ~1000, App Store ~4000).
 */
export const ABOUT_LONG_MAX = 2000;
