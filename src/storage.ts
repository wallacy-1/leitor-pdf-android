import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import { PdfEngineApi } from './components/PdfEngine';
import { PdfDoc } from './types';

const KEY = '@leitor-pdf/recentes';
const pdfDir = new Directory(Paths.document, 'pdfs');

export const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

export function safeFileName(name: string): string {
  return name.replace(INVALID_FILENAME_CHARS, '_');
}

/** Nome de arquivo a partir de uma URL (último segmento, sem query, com .pdf garantido). */
export function fileNameFromUrl(url: string): string {
  let last = '';
  try {
    last = decodeURIComponent(url.split('?')[0].split('#')[0].split('/').pop() || '');
  } catch {
    last = '';
  }
  const base = last.trim() || 'documento.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/** Mesmo arquivo já importado (nome + tamanho) — usado para não duplicar ao receber intents. */
export function findDuplicate(
  recents: PdfDoc[],
  doc: Pick<PdfDoc, 'name' | 'size'>,
): PdfDoc | undefined {
  // Sem tamanho conhecido (content provider sem SIZE) não dá para afirmar que é o mesmo arquivo.
  if (!doc.size) return undefined;
  return recents.find((d) => d.name === doc.name && d.size === doc.size);
}

export function docDirectory(id: string): Directory {
  return new Directory(pdfDir, id);
}

/** Preenche campos ausentes (documentos salvos por versões antigas do app). */
export function normalize(d: Partial<PdfDoc> & Pick<PdfDoc, 'id' | 'name' | 'uri'>): PdfDoc {
  return {
    size: 0,
    addedAt: 0,
    openedAt: d.addedAt ?? 0,
    lastPage: 1,
    totalPages: 0,
    bookmarks: [],
    ...d,
  };
}

export async function loadRecents(): Promise<PdfDoc[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as PdfDoc[]).map(normalize);
  } catch {
    return [];
  }
}

// Escritas em AsyncStorage são leitura-modificação-escrita; chamadas concorrentes
// (progresso de página × miniatura × marcadores) se sobrescreviam. Fila única resolve.
let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(op: () => Promise<T>): Promise<T> {
  const next = writeChain.then(op, op);
  writeChain = next.catch(() => undefined);
  return next;
}

/** Substitui a lista inteira (serializado). Prefira `mutateRecents` para não perder escritas concorrentes. */
export function saveRecents(docs: PdfDoc[]): Promise<void> {
  return serialized(() => AsyncStorage.setItem(KEY, JSON.stringify(docs)));
}

/** Lê-modifica-escreve atômico em relação às outras escritas deste módulo. */
export function mutateRecents(fn: (docs: PdfDoc[]) => PdfDoc[]): Promise<PdfDoc[]> {
  return serialized(async () => {
    const next = fn(await loadRecents());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  });
}

export function updateDoc(id: string, patch: Partial<PdfDoc>): Promise<PdfDoc[]> {
  return mutateRecents((docs) => docs.map((d) => (d.id === id ? { ...d, ...patch } : d)));
}

/**
 * Copia o PDF (file:// ou content://) para o diretório persistente do app.
 * URIs content:// vindas de intents expiram; por isso a cópia.
 * Layout: pdfs/<id>/<nome original> — assim o nome fica limpo ao compartilhar.
 */
export async function importPdf(sourceUri: string, name?: string, size?: number): Promise<PdfDoc> {
  const src = new File(sourceUri);
  if (!src.exists) {
    throw new Error('Arquivo de origem inacessível (sem permissão ou inexistente).');
  }
  const displayName = name || src.name || 'documento.pdf';
  const bytes = size ?? src.size ?? 0;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = safeFileName(displayName);
  const docDir = new Directory(pdfDir, id);
  docDir.create({ intermediates: true });
  const dest = new File(docDir, safeName);
  await src.copy(dest);
  if (!dest.exists) {
    throw new Error('Falha ao copiar o arquivo.');
  }
  const now = Date.now();
  return normalize({
    id,
    name: displayName,
    uri: dest.uri,
    size: bytes,
    addedAt: now,
    openedAt: now,
  });
}

function thumbFile(doc: PdfDoc): File {
  return new File(docDirectory(doc.id), 'thumb.jpg');
}

/** Miniatura da primeira página via PdfRenderer nativo (rápido; falha em PDF protegido). */
export async function generateThumbnail(doc: PdfDoc): Promise<string | undefined> {
  try {
    const { uri } = await PdfThumbnail.generate(doc.uri, 0, 60);
    const dest = thumbFile(doc);
    if (dest.exists) dest.delete();
    await new File(uri).move(dest);
    return dest.uri;
  } catch {
    return undefined;
  }
}

/**
 * Miniatura via pdf.js. Usado quando o nativo falha (PDF protegido/corrompido).
 * Com senha, NÃO grava em disco (conteúdo protegido fica só em memória) — retorna data URI.
 */
export async function generateThumbnailViaEngine(
  engine: PdfEngineApi,
  doc: PdfDoc,
  password?: string,
): Promise<string | undefined> {
  try {
    const { base64 } = await engine.renderPage(doc.uri, 1, 300, password);
    if (password) return `data:image/jpeg;base64,${base64}`;
    const dest = thumbFile(doc);
    dest.write(base64, { encoding: 'base64' });
    return dest.uri;
  } catch {
    return undefined;
  }
}

export const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
export const DOWNLOAD_TIMEOUT_MS = 60 * 1000;

/**
 * Baixa um PDF por URL (https) para pdfs/<id>/ e registra como documento.
 * Limites: 100 MB e 60 s — o arquivo é lido em memória (RN não tem streaming para disco com abort).
 */
export async function importPdfFromUrl(url: string): Promise<PdfDoc> {
  if (!/^https:\/\//i.test(url)) {
    throw new Error('Só endereços https:// são aceitos.');
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const docDir = docDirectory(id);
  const name = fileNameFromUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Servidor respondeu ${res.status}.`);
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_DOWNLOAD_BYTES) throw new Error('Arquivo maior que 100 MB.');
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('Arquivo maior que 100 MB.');
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
      throw new Error('O endereço não retornou um PDF.');
    }
    docDir.create({ intermediates: true });
    const dest = new File(docDir, safeFileName(name));
    dest.write(bytes);
    const now = Date.now();
    return normalize({
      id,
      name,
      uri: dest.uri,
      size: bytes.byteLength,
      addedAt: now,
      openedAt: now,
    });
  } catch (e) {
    try {
      if (docDir.exists) docDir.delete();
    } catch {
      // ignora
    }
    if ((e as Error).name === 'AbortError') throw new Error('Tempo esgotado (60 s).');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Miniatura de uma página (grade de páginas). Cache em pdfs/<id>/pages/<n>.jpg.
 * Nativo primeiro; pdf.js quando falha. Com senha, não grava em disco (retorna data URI).
 */
export async function getPageThumbnail(
  engine: PdfEngineApi,
  doc: PdfDoc,
  page: number,
  password?: string,
): Promise<string | undefined> {
  const dir = new Directory(docDirectory(doc.id), 'pages');
  const dest = new File(dir, `${page}.jpg`);
  if (dest.exists) return dest.uri;
  try {
    if (!dir.exists) dir.create({ intermediates: true });
    try {
      const { uri } = await PdfThumbnail.generate(doc.uri, page - 1, 40);
      await new File(uri).move(dest);
      return dest.uri;
    } catch {
      const { base64 } = await engine.renderPage(doc.uri, page, 240, password);
      if (password) return `data:image/jpeg;base64,${base64}`;
      dest.write(base64, { encoding: 'base64' });
      return dest.uri;
    }
  } catch {
    return undefined;
  }
}

/** Remove restos de OCR (cache/ocr-*.jpg) deixados por um encerramento abrupto. */
export function cleanupOcrTemp(): void {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File && /^ocr-.*\.jpg$/.test(entry.name)) entry.delete();
    }
  } catch {
    // cache inacessível: ignora
  }
}

export async function renameDoc(id: string, name: string): Promise<PdfDoc[]> {
  return updateDoc(id, { name: name.trim() });
}

export function removeDocFiles(doc: PdfDoc): void {
  try {
    const dir = docDirectory(doc.id);
    if (dir.exists) dir.delete();
  } catch {
    // já removido
  }
}

/** Bytes ocupados por documentos + caches (pdfs/). */
export function storageUsage(): { documents: number; caches: number } {
  let documents = 0;
  let caches = 0;
  try {
    if (!pdfDir.exists) return { documents, caches };
    for (const entry of pdfDir.list()) {
      if (!(entry instanceof Directory)) continue;
      for (const item of entry.list()) {
        if (item instanceof Directory)
          caches += item.size ?? 0; // pages/
        else if (/^(thumb\.jpg|text\.json)$/.test(item.name)) caches += item.size ?? 0;
        else documents += item.size ?? 0;
      }
    }
  } catch {
    // diretório inacessível
  }
  return { documents, caches };
}

/** Apaga caches regeneráveis (texto extraído/OCR, miniaturas de páginas e capas). */
export async function clearCaches(): Promise<void> {
  try {
    if (!pdfDir.exists) return;
    for (const entry of pdfDir.list()) {
      if (!(entry instanceof Directory)) continue;
      for (const item of entry.list()) {
        if (item instanceof Directory || /^(thumb\.jpg|text\.json)$/.test(item.name)) item.delete();
      }
    }
  } catch {
    // ignora
  }
  await mutateRecents((docs) => docs.map((d) => ({ ...d, thumbUri: undefined })));
}

/** Remove todos os documentos e a lista de recentes. */
export async function removeAllDocs(): Promise<void> {
  try {
    if (pdfDir.exists) pdfDir.delete();
  } catch {
    // ignora
  }
  await saveRecents([]);
}
