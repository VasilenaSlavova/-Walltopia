/* Small dependency-free ZIP writer (stored entries, no compression). */
(function (root) {
  "use strict";
  var table = null;
  function crc32(bytes) {
    if (!table) {
      table = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function utf8(value) {
    var encoded = unescape(encodeURIComponent(String(value)));
    var bytes = new Uint8Array(encoded.length);
    for (var i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
    return bytes;
  }
  function view(size) { return { bytes: new Uint8Array(size), data: new DataView(new ArrayBuffer(size)) }; }
  function header(size, writer) {
    var buffer = new ArrayBuffer(size), data = new DataView(buffer);
    writer(data);
    return new Uint8Array(buffer);
  }
  function join(parts) {
    var size = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    var result = new Uint8Array(size), offset = 0;
    parts.forEach(function (part) { result.set(part, offset); offset += part.length; });
    return result;
  }
  function create(files) {
    var locals = [], centrals = [], offset = 0;
    files.forEach(function (file) {
      var name = utf8(file.name), bytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      var crc = crc32(bytes), localOffset = offset;
      var local = header(30, function (d) {
        d.setUint32(0, 0x04034b50, true); d.setUint16(4, 20, true); d.setUint16(6, 0x0800, true);
        d.setUint16(8, 0, true); d.setUint32(10, 0, true); d.setUint32(14, crc, true);
        d.setUint32(18, bytes.length, true); d.setUint32(22, bytes.length, true); d.setUint16(26, name.length, true); d.setUint16(28, 0, true);
      });
      locals.push(local, name, bytes); offset += local.length + name.length + bytes.length;
      var central = header(46, function (d) {
        d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true);
        d.setUint16(10, 0, true); d.setUint32(12, 0, true); d.setUint32(16, crc, true);
        d.setUint32(20, bytes.length, true); d.setUint32(24, bytes.length, true); d.setUint16(28, name.length, true);
        d.setUint16(30, 0, true); d.setUint16(32, 0, true); d.setUint16(34, 0, true); d.setUint16(36, 0, true);
        d.setUint32(38, 0, true); d.setUint32(42, localOffset, true);
      });
      centrals.push(central, name);
    });
    var centralBytes = join(centrals), centralOffset = offset;
    var end = header(22, function (d) {
      d.setUint32(0, 0x06054b50, true); d.setUint16(4, 0, true); d.setUint16(6, 0, true);
      d.setUint16(8, files.length, true); d.setUint16(10, files.length, true);
      d.setUint32(12, centralBytes.length, true); d.setUint32(16, centralOffset, true); d.setUint16(20, 0, true);
    });
    return join(locals.concat([centralBytes, end]));
  }
  root.WTZip = { create: create };
})(window);
