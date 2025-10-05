class SimpleZipCreator {
  constructor() {
    this.files = new Map();
    this.directories = new Set();
  }

  addFile(path, content) {
    const pathParts = path.split('/');
    if (pathParts.length > 1) {
      let currentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath += (currentPath ? '/' : '') + pathParts[i];
        this.directories.add(currentPath);
      }
    }

    this.files.set(path, content);
  }

  addDirectory(path) {
    this.directories.add(path);
  }

  async generateBlob() {
    const entries = [];
    const centralDirectory = [];
    let offset = 0;

    for (const dir of this.directories) {
      const entry = this.createDirectoryEntry(dir);
      entries.push(entry.localHeader);

      centralDirectory.push(this.createCentralDirectoryEntry(dir, true, offset, 0));
      offset += entry.localHeader.byteLength;
    }

    for (const [path, content] of this.files) {
      let data;
      if (content instanceof Blob || content instanceof File) {
        data = new Uint8Array(await content.arrayBuffer());
      } else if (typeof content === 'string') {
        data = new TextEncoder().encode(content);
      } else if (content instanceof ArrayBuffer) {
        data = new Uint8Array(content);
      } else {
        data = new Uint8Array(content);
      }

      const entry = this.createFileEntry(path, data);
      entries.push(entry.localHeader);
      entries.push(data);

      centralDirectory.push(this.createCentralDirectoryEntry(path, false, offset, data.length));
      offset += entry.localHeader.byteLength + data.length;
    }

    const centralDirectoryStart = offset;
    const centralDirectorySize = centralDirectory.reduce((sum, entry) => sum + entry.byteLength, 0);

    const endOfCentralDirectory = this.createEndOfCentralDirectoryRecord(
      centralDirectory.length,
      centralDirectorySize,
      centralDirectoryStart
    );

    const totalSize = offset + centralDirectorySize + endOfCentralDirectory.byteLength;
    const zipData = new Uint8Array(totalSize);

    let position = 0;

    for (const entry of entries) {
      zipData.set(new Uint8Array(entry), position);
      position += entry.byteLength;
    }

    for (const entry of centralDirectory) {
      zipData.set(new Uint8Array(entry), position);
      position += entry.byteLength;
    }

    zipData.set(new Uint8Array(endOfCentralDirectory), position);

    return new Blob([zipData], { type: 'application/zip' });
  }

  createFileEntry(filename, data) {
    const filenameBytes = new TextEncoder().encode(filename);
    const crc32 = this.calculateCRC32(data);

    const localHeader = new ArrayBuffer(30 + filenameBytes.length);
    const view = new DataView(localHeader);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc32, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, filenameBytes.length, true);
    view.setUint16(28, 0, true);

    const headerArray = new Uint8Array(localHeader);
    headerArray.set(filenameBytes, 30);

    return { localHeader: headerArray.buffer };
  }

  createDirectoryEntry(dirname) {
    const dirnameBytes = new TextEncoder().encode(dirname + '/');

    const localHeader = new ArrayBuffer(30 + dirnameBytes.length);
    const view = new DataView(localHeader);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, 0, true);
    view.setUint32(22, 0, true);
    view.setUint16(26, dirnameBytes.length, true);
    view.setUint16(28, 0, true);

    const headerArray = new Uint8Array(localHeader);
    headerArray.set(dirnameBytes, 30);

    return { localHeader: headerArray.buffer };
  }

  createCentralDirectoryEntry(filename, isDirectory, offset, uncompressedSize) {
    const name = isDirectory ? filename + '/' : filename;
    const nameBytes = new TextEncoder().encode(name);

    const entry = new ArrayBuffer(46 + nameBytes.length);
    const view = new DataView(entry);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, 0, true);
    view.setUint32(20, uncompressedSize, true);
    view.setUint32(24, uncompressedSize, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, isDirectory ? 0x10 : 0, true);
    view.setUint32(42, offset, true);

    const entryArray = new Uint8Array(entry);
    entryArray.set(nameBytes, 46);

    return entryArray.buffer;
  }

  createEndOfCentralDirectoryRecord(totalEntries, centralDirectorySize, centralDirectoryOffset) {
    const record = new ArrayBuffer(22);
    const view = new DataView(record);

    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, totalEntries, true);
    view.setUint16(10, totalEntries, true);
    view.setUint32(12, centralDirectorySize, true);
    view.setUint32(16, centralDirectoryOffset, true);
    view.setUint16(20, 0, true);

    return record;
  }

  calculateCRC32(data) {
    const crcTable = this.makeCRCTable();
    let crc = 0 ^ (-1);

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
  }

  makeCRCTable() {
    if (this._crcTable) return this._crcTable;

    this._crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      this._crcTable[n] = c;
    }
    return this._crcTable;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleZipCreator;
}