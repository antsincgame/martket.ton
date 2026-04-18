import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

vi.mock('../lib/storeApi', () => ({
  storeApiUrl: (path: string) => `http://localhost:8081${path}`,
}));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ errorId: 'ce_test123' }), { status: 200 }),
  ) as unknown as typeof fetch;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function ThrowingChild({ error }: { error?: Error }) {
  if (error) throw error;
  return <div>child content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('hello')).toBeDefined();
  });

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('Test crash')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText('Test crash')).toBeDefined();
  });

  it('shows Try Again button that resets state', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a">
        <ThrowingChild error={new Error('boom')} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();

    rerender(
      <ErrorBoundary resetKey="b">
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('child content')).toBeDefined();
  });

  it('shows Return Home button', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('oops')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Return Home')).toBeDefined();
  });

  it('reports error to backend via POST /api/client-errors', async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('report me')} />
      </ErrorBoundary>,
    );

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalled();
    const clientErrorCall = fetchMock.mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('client-errors'),
    );
    expect(clientErrorCall).toBeDefined();
    const [url, init] = clientErrorCall!;
    expect(url).toBe('http://localhost:8081/api/client-errors');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.message).toBe('report me');
    expect(body.pathname).toBeDefined();
  });

  it('shows Copy button for error details', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('copy test')} />
      </ErrorBoundary>,
    );
    const copyButton = screen.getByTitle('Copy error info');
    expect(copyButton).toBeDefined();
  });
});
