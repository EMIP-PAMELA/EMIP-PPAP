import { createHash } from 'crypto';

function toBuffer(data: ArrayBuffer | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

export function hashBuffer(data: ArrayBuffer | Buffer | Uint8Array): string {
  const hash = createHash('sha256');
  hash.update(toBuffer(data));
  return hash.digest('hex');
}

export function hashText(text: string): string {
  const hash = createHash('sha256');
  hash.update(text, 'utf8');
  return hash.digest('hex');
}
