import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdminTabs } from './useAdminTabs';
import { ADMIN_TABS } from './tabs.config';

const allowAll = (): boolean => true;
const denyAll = (): boolean => false;
const onlyUsersRead = (resource: string, action: string): boolean =>
  resource === 'users' && action === 'read';

describe('useAdminTabs (characterization)', () => {
  it('returns all tabs when permission checker allows everything', () => {
    const { result } = renderHook(() => useAdminTabs(allowAll, 'security'));
    expect(result.current.availableTabs).toHaveLength(ADMIN_TABS.length);
    expect(result.current.activeTabData?.id).toBe('security');
  });

  it('returns empty list and undefined activeTabData when nothing is allowed', () => {
    const { result } = renderHook(() => useAdminTabs(denyAll, 'security'));
    expect(result.current.availableTabs).toHaveLength(0);
    expect(result.current.activeTabData).toBeUndefined();
  });

  it('falls back to first available tab when active tab id has no permission', () => {
    const { result } = renderHook(() => useAdminTabs(onlyUsersRead, 'security'));
    expect(result.current.availableTabs.map((tab) => tab.id)).toEqual(['users']);
    expect(result.current.activeTabData?.id).toBe('users');
  });

  it('selects the requested active tab when user has permission for it', () => {
    const { result } = renderHook(() => useAdminTabs(allowAll, 'commerce'));
    expect(result.current.activeTabData?.id).toBe('commerce');
  });
});
