// 原始请求只编码一次；重试复用原字节，不能重排JSON后沿用requestId。
export type Bytes = { decodedBytes: number; base64: string };
export function encodeBytes(bytes: Uint8Array): Bytes {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return { decodedBytes: bytes.length, base64: btoa(binary) };
}
export function encodeJSON(value: unknown): Bytes {
  return encodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}
export function decodeBytes(value: Bytes, maximum = 8388608): Uint8Array {
  if (!Number.isSafeInteger(value.decodedBytes) || value.decodedBytes < 0 || value.decodedBytes > maximum ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64))
    throw new Error("INVALID_MESSAGE");
  const raw = atob(value.base64);
  if (raw.length !== value.decodedBytes || btoa(raw) !== value.base64) throw new Error("INVALID_MESSAGE");
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
export function decodeJSON<T>(value: Bytes): T {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBytes(value))) as T;
}
