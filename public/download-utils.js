export function downloadName(baseName, extension) {
  const randomId = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 8)
    || Math.random().toString(36).slice(2, 10);
  const suffix = extension.startsWith('.') ? extension : `.${extension}`;
  return `${baseName}-${randomId}${suffix}`;
}
