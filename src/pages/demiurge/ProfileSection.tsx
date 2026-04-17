// Identity / Public Profile section.
//
// Implementation lives in `SettingsSection.tsx` — which also hosts the two-column
// editor (form on the left, live public-profile card preview on the right), the
// Sticky Action Bar, and the shared ImageUploader for avatar/banner. This file is
// kept as an explicit entry point from the router/nav at `/profile/profile` so that
// if identity logic is split out later (e.g. a separate roles page) the routes
// don't need to change — just swap the implementation here.
import SettingsSection, { type SettingsSectionProps } from './SettingsSection';

export default function ProfileSection(props: SettingsSectionProps) {
  return <SettingsSection {...props} />;
}
