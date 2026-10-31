// Images and videos live in the Backblaze bucket (AKT-MEDIA-PRODUCTIONS). The API server
// streams them from /api/assets/<folder>/<file>, so the bucket can stay private.
export function assetUrl(folder: string, file: string): string {
  return `/api/assets/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`
}

export const LOGO = assetUrl("Site Images", "akt-logo.png")
