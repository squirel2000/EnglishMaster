import { vi } from 'vitest';

/** Stub global fetch to resolve with a JSON response; returns the mock. */
export function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}
