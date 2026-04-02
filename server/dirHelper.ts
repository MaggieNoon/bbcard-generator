// Compatible __dirname for both tsx (ESM) dev and esbuild (CJS) production
// In CJS builds, __dirname is natively available; in ESM (tsx), we use import.meta
let _dirname: string;
try {
  // This works in CJS (production build via esbuild)
  // eslint-disable-next-line no-undef
  _dirname = __dirname;
} catch {
  // This works in ESM (tsx dev server)
  const { dirname } = await import("path");
  const { fileURLToPath } = await import("url");
  _dirname = dirname(fileURLToPath(import.meta.url));
}
export const serverDir = _dirname;
