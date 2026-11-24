// A small zip reader and writer with no dependencies, for TraceCite packages (.trace.zip).
// Works in the browser and in Node 20+ (both have CompressionStream and DecompressionStream).
//
//   TraceZip.read(bytes)            -> Promise<Map<path, Uint8Array>>   stored and deflated entries
//   TraceZip.write(files, {deflate, date}) -> Promise<Uint8Array>        files: [[path, Uint8Array|string], …]
//   TraceZip.text(bytes)            -> string (UTF-8)
//
// Reading goes through the central directory at the end of the file (so sizes are always known), then
// inflates each entry with DecompressionStream('deflate-raw'). Zip64, encryption and multi-disk archives
// are not supported; TraceCite packages never need them.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TraceZip = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function pipe(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  const inflate = (b) => pipe(b, new DecompressionStream('deflate-raw'));
  const deflate = (b) => pipe(b, new CompressionStream('deflate-raw'));

  async function read(input) {
    const b = input instanceof Uint8Array ? input : new Uint8Array(input);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a zip file (no end-of-directory record).');
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const files = new Map();
    for (let n = 0; n < count; n++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Broken zip central directory.');
      const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true);
      const csize = v.getUint32(p + 20, true), size = v.getUint32(p + 24, true);
      const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (flags & 1) throw new Error(`${name} is encrypted.`);
      if (name.endsWith('/')) continue;
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const raw = b.subarray(start, start + csize);
      let data;
      if (method === 0) data = raw.slice();
      else if (method === 8) data = await inflate(raw);
      else throw new Error(`${name} uses compression method ${method}, which is not supported.`);
      if (data.length !== size) throw new Error(`${name} did not unpack to its stated size.`);
      files.set(name, data);
    }
    return files;
  }

  // date: the entries' modification time (default now). Pass a fixed one for reproducible builds.
  async function write(entries, { deflate: useDeflate = true, date: when } = {}) {
    const parts = [], central = [];
    let offset = 0;
    const now = when ? new Date(when) : new Date();
    const time = (now.getUTCHours() << 11) | (now.getUTCMinutes() << 5) | (now.getUTCSeconds() >> 1);   // UTC: the same bytes on every machine
    const date = ((now.getUTCFullYear() - 1980) << 9) | ((now.getUTCMonth() + 1) << 5) | now.getUTCDate();
    for (const [path, content] of entries) {
      const data = typeof content === 'string' ? enc.encode(content) : content;
      const name = enc.encode(path);
      const crc = crc32(data);
      let body = data, method = 0;
      if (useDeflate && data.length > 64) { const z = await deflate(data); if (z.length < data.length) { body = z; method = 8; } }
      const head = new DataView(new ArrayBuffer(30));
      head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(8, method, true);
      head.setUint16(10, time, true); head.setUint16(12, date, true); head.setUint32(14, crc, true);
      head.setUint32(18, body.length, true); head.setUint32(22, data.length, true); head.setUint16(26, name.length, true);
      parts.push(new Uint8Array(head.buffer), name, body);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, method, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, body.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const csize = central.reduce((s, x) => s + x.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
    let at = 0; for (const x of all) { out.set(x, at); at += x.length; }
    return out;
  }
  return { read, write, crc32, text: (b) => dec.decode(b) };
});
