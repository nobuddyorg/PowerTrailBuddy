/** Hands the browser a file to save under `name`; nothing leaves the device. */
export function downloadFile({
  name,
  data,
  type,
}: {
  name: string;
  data: BlobPart;
  type: string;
}): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked after the click has been handled, or some browsers save nothing.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
