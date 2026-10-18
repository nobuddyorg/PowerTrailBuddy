import { vi } from 'vitest';

// A SecurityError is what a browser throws once site data is blocked.
export function refuseStorage(method: 'getItem' | 'setItem') {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
}
