export function basePath(): string {
  // Read as a literal `process.env.X` expression, the only form Next's static export inlines.
  return process.env.NEXT_PUBLIC_BASE_PATH ?? '';
}

export function withBasePath(path: `/${string}`): string {
  return `${basePath()}${path}`;
}
