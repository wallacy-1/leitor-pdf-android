// Sistema de arquivos em memória, o suficiente para storage/textIndex.
const files = new Map();

function join(parts) {
  return parts
    .map((p) => (typeof p === 'string' ? p : p.uri))
    .join('/')
    .replace(/^file:\/+/, 'file:///')
    .replace(/(?<!:\/?)\/{2,}/g, '/');
}

class Directory {
  constructor(...parts) {
    this.uri = join(parts);
  }
  get exists() {
    return [...files.keys()].some((k) => k.startsWith(this.uri + '/'));
  }
  create() {}
  list() {
    const prefix = this.uri + '/';
    return [...files.keys()]
      .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .map((k) => new File(k));
  }
  delete() {
    for (const k of [...files.keys()]) if (k.startsWith(this.uri + '/')) files.delete(k);
  }
}

class File {
  constructor(...parts) {
    this.uri = join(parts);
  }
  get exists() {
    return files.has(this.uri);
  }
  get name() {
    return this.uri.split('/').pop();
  }
  get size() {
    return (files.get(this.uri) || '').length;
  }
  write(content) {
    files.set(this.uri, content);
  }
  async text() {
    return files.get(this.uri);
  }
  async copy(dest) {
    files.set(dest.uri, files.get(this.uri));
  }
  async move(dest) {
    files.set(dest.uri, files.get(this.uri));
    files.delete(this.uri);
  }
  delete() {
    files.delete(this.uri);
  }
}

const Paths = { document: new Directory('file:///doc'), cache: new Directory('file:///cache') };

module.exports = { Directory, File, Paths, __files: files, __reset: () => files.clear() };
