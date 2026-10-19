// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadFile } from './download';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('downloadFile', () => {
  it('saves the data under the name through a temporary link, then frees the blob', async () => {
    vi.useFakeTimers();
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:local/1';
    });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
    });

    downloadFile({
      name: 'trail.gpx',
      data: '<gpx/>',
      type: 'application/gpx+xml',
    });

    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe('trail.gpx');
    expect(clicks[0].href).toBe('blob:local/1');
    expect(clicks[0].isConnected).toBe(false);
    expect(blobs[0].type).toBe('application/gpx+xml');
    expect(await blobs[0].text()).toBe('<gpx/>');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local/1');
  });
});
