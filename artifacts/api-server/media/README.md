# Private media directory

This folder is read only by `GET /api/audio/stream/:trackId`. It is **not**
served by `express.static`, so files here cannot be fetched by guessing a URL.

The lossless playback masters. The server looks for the **first name** in each
row, then the others, then any file whose name matches loosely (capitals, spaces,
hyphens and a trailing "(3)" are ignored). Use the first name when uploading:

| Track | Preferred file name | Also accepted |
|---|---|---|
| Don't Be Dumb | `dont-be-dumb.wav` | `Don't Be Dumb.wav` |
| Ekseni | `ekseni.wav` | `Ekseni.wav` |
| Masambe | `masambe.wav` | `Masambe.wav` |
| Money Moves | `money-moves.wav` | `Money Moves.wav`, `Money Moves (3).wav` |
| Drip | `drip.wav` | `Drip.wav` |

## WAV format (important)

Browsers can only decode **8/16/24/32-bit PCM** and **32-bit float** WAV files.
**64-bit float WAV (a common DAW export setting) will not play in Chrome, Edge,
Firefox or Safari.** Export masters as **24-bit PCM WAV**.

On every start the server writes an "Audio file OK / CANNOT be played / NOT FOUND"
line per track to the log, so a bad file shows up in Render's Logs right away.

## Local development

Files in this folder are ignored by Git so they cannot be committed to the
public repository by accident. From the repository root on the studio machine,
run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\import-secure-media.ps1
```

The directory defaults to `artifacts/api-server/media` and can be overridden
with the `MEDIA_DIR` environment variable.

## Render / object storage

Free Render instances have an ephemeral filesystem, so use a private S3-compatible
bucket. Cloudflare R2 and Backblaze B2 both work. When `S3_BUCKET` is set, the
server ignores `MEDIA_DIR` and streams directly from the bucket.

Upload the five files above to the bucket root, or to a prefix such as `audio/`
and set `S3_KEY_PREFIX=audio`. Keep the bucket private.

Backblaze B2 environment variables:

```text
S3_BUCKET=<bucket-name>
S3_ENDPOINT=https://s3.<region>.backblazeb2.com
S3_REGION=<region>
S3_ACCESS_KEY_ID=<application-key-id>
S3_SECRET_ACCESS_KEY=<application-key>
S3_FORCE_PATH_STYLE=true
```

Cloudflare R2 environment variables:

```text
S3_BUCKET=<bucket-name>
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=<access-key-id>
S3_SECRET_ACCESS_KEY=<secret-access-key>
```

Optional:

```text
S3_KEY_PREFIX=audio
```

The credentials only need object read access. Do not expose them to the frontend.
