/**
 * data/bmp.js — minimal 24-bit BMP encoder. Targets the exact format DDCS Expert CAM icons use,
 * confirmed vs factory camN.bmp: 24bpp, bottom-up rows, BI_RGB, 54-byte header (BITMAPFILEHEADER 14 +
 * BITMAPINFOHEADER 40), rows padded to a 4-byte boundary. Input = an RGBA buffer (canvas getImageData).
 */
export function encodeBmp24(width, height, rgba) {
    const rowRaw = width * 3;
    const rowPad = (4 - (rowRaw % 4)) % 4;
    const rowSize = rowRaw + rowPad;
    const pixSize = rowSize * height;
    const fileSize = 54 + pixSize;
    const buf = new Uint8Array(fileSize);
    const dv = new DataView(buf.buffer);
    buf[0] = 0x42; buf[1] = 0x4D;                 // 'BM'
    dv.setUint32(2, fileSize, true);
    dv.setUint32(10, 54, true);                   // pixel-data offset
    dv.setUint32(14, 40, true);                   // DIB header size (BITMAPINFOHEADER)
    dv.setInt32(18, width, true);
    dv.setInt32(22, height, true);                // positive height = bottom-up
    dv.setUint16(26, 1, true);                    // planes
    dv.setUint16(28, 24, true);                   // bits per pixel
    dv.setUint32(30, 0, true);                    // BI_RGB (uncompressed)
    dv.setUint32(34, pixSize, true);
    dv.setInt32(38, 2835, true); dv.setInt32(42, 2835, true);   // ~72 DPI x/y
    let o = 54;
    for (let y = height - 1; y >= 0; y--) {       // bottom row first
        let s = y * width * 4;
        for (let x = 0; x < width; x++) {
            buf[o++] = rgba[s + 2]; buf[o++] = rgba[s + 1]; buf[o++] = rgba[s];   // B, G, R
            s += 4;
        }
        for (let p = 0; p < rowPad; p++) buf[o++] = 0;
    }
    return buf;
}

/** Encode → a `data:image/bmp;base64,…` URL (browsers render BMP in <img>). */
export function bmpDataUrl(width, height, rgba) {
    const buf = encodeBmp24(width, height, rgba);
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return 'data:image/bmp;base64,' + (typeof btoa === 'function' ? btoa(bin) : Buffer.from(buf).toString('base64'));
}
