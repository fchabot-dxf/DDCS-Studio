/**
 * data/zip.js — minimal STORE-only (no compression) ZIP writer. No dependencies. Enough to bundle a CAM pack
 * (text macros/eng/readme + binary camN.bmp) into a USB-ready .zip the community installs.
 */
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
})();
function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
const enc = (s) => new TextEncoder().encode(String(s));
const u16 = (n) => [n & 0xFF, (n >> 8) & 0xFF];
const u32 = (n) => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >>> 24) & 0xFF];

/** files: [{ name, data: Uint8Array | string }] → a Uint8Array of a valid store-only zip. */
export function makeZip(files) {
    const parts = [], central = [];
    let offset = 0, count = 0;
    for (const f of files) {
        const name = enc(f.name), data = f.data instanceof Uint8Array ? f.data : enc(f.data), crc = crc32(data);
        const local = new Uint8Array([].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)));
        parts.push(local, name, data);
        central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
        offset += local.length + name.length + data.length; count++;
    }
    const cdStart = offset; let cdLen = 0; central.forEach((c) => { cdLen += c.length; });
    const eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(count), u16(count), u32(cdLen), u32(cdStart), u16(0)));
    const all = [...parts, ...central, eocd];
    let total = 0; all.forEach((a) => { total += a.length; });
    const out = new Uint8Array(total); let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
}

/** Trigger a browser download of bytes as `filename`. */
export function downloadBytes(filename, bytes, mime = 'application/zip') {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
