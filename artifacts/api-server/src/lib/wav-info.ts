// Reads a WAV header so we can tell, before a visitor hits play, whether browsers can decode the file.

export type WavInfo = {
  formatTag: number;
  bits: number;
  channels: number;
  sampleRate: number;
  playable: boolean;
  summary: string;
  problem?: string;
};

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_FLOAT = 3;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

function describeFormat(tag: number): string {
  if (tag === WAVE_FORMAT_PCM) return "PCM";
  if (tag === WAVE_FORMAT_FLOAT) return "float";
  return `format 0x${tag.toString(16)}`;
}

/** `head` should be the first few KB of the file. Returns undefined when it is not a readable WAV. */
export function parseWavHeader(head: Buffer): WavInfo | undefined {
  if (head.length < 12) return undefined;
  const riff = head.toString("ascii", 0, 4);
  if ((riff !== "RIFF" && riff !== "RF64") || head.toString("ascii", 8, 12) !== "WAVE") {
    return undefined;
  }

  let offset = 12;
  while (offset + 8 <= head.length) {
    const id = head.toString("ascii", offset, offset + 4);
    const size = head.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === "fmt ") {
      if (size < 16 || body + 16 > head.length) return undefined;
      let formatTag = head.readUInt16LE(body);
      const channels = head.readUInt16LE(body + 2);
      const sampleRate = head.readUInt32LE(body + 4);
      const bits = head.readUInt16LE(body + 14);

      // WAVE_FORMAT_EXTENSIBLE hides the real format tag in the sub-format GUID.
      if (formatTag === WAVE_FORMAT_EXTENSIBLE && size >= 40 && body + 26 <= head.length) {
        formatTag = head.readUInt16LE(body + 24);
      }

      const pcmOk = formatTag === WAVE_FORMAT_PCM && [8, 16, 24, 32].includes(bits);
      const floatOk = formatTag === WAVE_FORMAT_FLOAT && bits === 32;
      const playable = pcmOk || floatOk;
      const kind = describeFormat(formatTag);
      const layout = channels === 1 ? "mono" : channels === 2 ? "stereo" : `${channels} ch`;

      return {
        formatTag,
        bits,
        channels,
        sampleRate,
        playable,
        summary: `${bits}-bit ${kind}, ${sampleRate} Hz, ${layout}`,
        problem: playable
          ? undefined
          : `${bits}-bit ${kind} WAV cannot be decoded by Chrome, Edge, Firefox or Safari. ` +
            "Re-export it as 24-bit (or 16-bit) PCM WAV.",
      };
    }

    offset = body + size + (size & 1);
  }
  return undefined;
}
