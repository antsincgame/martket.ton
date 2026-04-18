import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DemoUiBadge from './DemoUiBadge';

describe('DemoUiBadge', () => {
  it('renders with default label "Demo UI"', () => {
    render(<DemoUiBadge />);
    expect(screen.getByText('Demo UI')).toBeDefined();
  });

  it('renders custom label', () => {
    render(<DemoUiBadge label="Demiurge" />);
    expect(screen.getByText('Demiurge')).toBeDefined();
  });

  it('renders inline variant as span', () => {
    const { container } = render(<DemoUiBadge variant="inline" />);
    const badge = container.querySelector('span');
    expect(badge).not.toBeNull();
  });

  it('renders corner variant with absolute positioning', () => {
    const { container } = render(<DemoUiBadge variant="corner" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('absolute');
  });

  it('renders floating variant with fixed positioning', () => {
    const { container } = render(<DemoUiBadge variant="floating" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('fixed');
  });

  it('applies correct tint classes for cyan', () => {
    const { container } = render(<DemoUiBadge tint="cyan" />);
    const text = container.querySelector('span span:last-child');
    expect(text?.className).toContain('text-[#00F5FF]');
  });

  it('applies correct tint classes for gold', () => {
    const { container } = render(<DemoUiBadge tint="gold" />);
    const text = container.querySelector('span span:last-child');
    expect(text?.className).toContain('text-[#FFD700]');
  });

  it('applies correct tint classes for magenta', () => {
    const { container } = render(<DemoUiBadge tint="magenta" />);
    const text = container.querySelector('span span:last-child');
    expect(text?.className).toContain('text-[#FF00FF]');
  });

  it('accepts additional className', () => {
    const { container } = render(<DemoUiBadge className="my-custom-class" />);
    const badge = container.firstElementChild;
    expect(badge?.className).toContain('my-custom-class');
  });
});
