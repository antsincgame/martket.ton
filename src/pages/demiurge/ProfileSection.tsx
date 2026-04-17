// Identity / Public Profile section.
//
// Реализация живёт в `SettingsSection.tsx` — там же двухколоночный editor
// (форма слева, live-preview карточки публичного профиля справа), Sticky
// Action Bar, и общий ImageUploader для аватара/баннера. Файл оставлен как
// явная точка входа из роутера/навигации `/profile/profile`, чтобы при
// будущей расколке identity-логики (например, отдельная страница ролей)
// не пришлось править маршруты — достаточно подменить реализацию здесь.
import SettingsSection, { type SettingsSectionProps } from './SettingsSection';

export default function ProfileSection(props: SettingsSectionProps) {
  return <SettingsSection {...props} />;
}
