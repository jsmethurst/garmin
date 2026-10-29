/* Minimal ZIP writer (stored, no compression; PNG/text are small). */
(function (GW) {
  'use strict';
  var table = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) { var c = 0xFFFFFFFF; for (var i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(v, a) { a.push(v & 255, (v >>> 8) & 255); }
  function u32(v, a) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }

  // files: [{path, data: string|Uint8Array, exec?: bool}] -> Blob
  GW.zip = function (files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    var d = new Date();
    var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.path), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var h = [];
      u32(0x04034b50, h); u16(20, h); u16(0x0800, h); u16(0, h); u16(dosTime, h); u16(dosDate, h);
      u32(crc, h); u32(data.length, h); u32(data.length, h); u16(name.length, h); u16(0, h);
      parts.push(new Uint8Array(h), name, data);
      var c = [];
      u32(0x02014b50, c); u16(f.exec ? 0x031E : 20, c); u16(20, c); u16(0x0800, c); u16(0, c); u16(dosTime, c); u16(dosDate, c);
      u32(crc, c); u32(data.length, c); u32(data.length, c); u16(name.length, c); u16(0, c); u16(0, c); u16(0, c); u16(0, c);
      u32(f.exec ? ((0o100755 << 16) >>> 0) : 0, c); u32(offset, c);
      central.push(new Uint8Array(c), name);
      offset += h.length + name.length + data.length;
    });
    var csize = 0; central.forEach(function (p) { csize += p.length; });
    var e = [];
    u32(0x06054b50, e); u16(0, e); u16(0, e); u16(files.length, e); u16(files.length, e); u32(csize, e); u32(offset, e); u16(0, e);
    return new Blob(parts.concat(central, [new Uint8Array(e)]), { type: 'application/zip' });
  };
})(window.GW);
