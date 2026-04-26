import { useMemo } from 'react';
import { ADMIN_TABS, type AdminTab } from './tabs.config';

type PermissionChecker = (resource: string, action: string) => boolean;

export interface UseAdminTabsResult {
  availableTabs: AdminTab[];
  activeTabData: AdminTab | undefined;
}

export const useAdminTabs = (
  hasPermission: PermissionChecker,
  activeTabId: string,
): UseAdminTabsResult => {
  const availableTabs = useMemo(
    () =>
      ADMIN_TABS.filter((tab) =>
        hasPermission(tab.requiredPermission.resource, tab.requiredPermission.action),
      ),
    [hasPermission],
  );

  const activeTabData = useMemo(
    () => availableTabs.find((tab) => tab.id === activeTabId) || availableTabs[0],
    [availableTabs, activeTabId],
  );

  return { availableTabs, activeTabData };
};
