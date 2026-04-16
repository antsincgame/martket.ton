import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';

function renderBreadcrumbs(items: { label: string; to?: string }[]) {
  return render(
    <MemoryRouter>
      <Breadcrumbs items={items} />
    </MemoryRouter>,
  );
}

describe('Breadcrumbs', () => {
  it('renders nothing for empty items', () => {
    const { container } = renderBreadcrumbs([]);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('always renders Store home link', () => {
    renderBreadcrumbs([{ label: 'Apps', to: '/category/apps' }]);
    expect(screen.getByLabelText('Store')).toBeDefined();
  });

  it('renders intermediate items as links', () => {
    renderBreadcrumbs([
      { label: 'Apps', to: '/category/apps' },
      { label: 'My App' },
    ]);
    const link = screen.getByTitle('Apps');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/category/apps');
  });

  it('renders last item as text (not a link)', () => {
    renderBreadcrumbs([
      { label: 'Apps', to: '/category/apps' },
      { label: 'My App' },
    ]);
    const lastItem = screen.getByTitle('My App');
    expect(lastItem.tagName).toBe('SPAN');
    expect(lastItem.getAttribute('aria-current')).toBe('page');
  });

  it('renders single item without link', () => {
    renderBreadcrumbs([{ label: 'Home Page' }]);
    const item = screen.getByTitle('Home Page');
    expect(item.tagName).toBe('SPAN');
    expect(item.getAttribute('aria-current')).toBe('page');
  });

  it('has proper aria-label on nav', () => {
    renderBreadcrumbs([{ label: 'Test' }]);
    expect(screen.getByLabelText('Breadcrumb')).toBeDefined();
  });
});
