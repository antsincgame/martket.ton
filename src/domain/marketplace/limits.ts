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
 * Манифест (About detailed) — короткое заявление на профиле.
 * 500 символов ≈ 80-90 слов — помещается в overlay на баннере без скролла,
 * работает как эффектный эпиграф, а не как блог-пост.
 * (Twitter ≈ 280, LinkedIn tagline ≈ 120, наш «Манифест» — сжатое заявление).
 */
export const ABOUT_LONG_MAX = 500;
