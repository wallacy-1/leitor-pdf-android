import { File, Paths } from 'expo-file-system';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { PdfEngineApi } from './components/PdfEngine';
import { docDirectory } from './storage';
import { PdfDoc, SearchHit } from './types';

const MIN_TEXT_CHARS = 20; // abaixo disso a página é tratada como escaneada (sem camada de texto)
const OCR_WIDTH = 1600;

export type IndexProgress =
  | { phase: 'extract'; page: number; total: number }
  | { phase: 'ocr'; page: number; total: number; done: number };

function cacheFile(doc: PdfDoc): File {
  return new File(docDirectory(doc.id), 'text.json');
}

/**
 * Texto de todas as páginas do documento. Páginas sem camada de texto passam por OCR (ML Kit).
 * Resultado é cacheado em pdfs/<id>/text.json — exceto para PDFs com senha (não persistir conteúdo protegido).
 */
export async function getDocText(
  engine: PdfEngineApi,
  doc: PdfDoc,
  password: string | undefined,
  onProgress: (p: IndexProgress) => void,
  isCancelled: () => boolean,
  ocr = true,
): Promise<string[]> {
  const cache = cacheFile(doc);
  if (!password && cache.exists) {
    try {
      return JSON.parse(await cache.text()) as string[];
    } catch {
      // cache corrompido: reindexa
    }
  }

  const texts = await engine.extractText(doc.uri, password, (page, total) =>
    onProgress({ phase: 'extract', page, total }),
  );

  const scanned = ocr
    ? texts.map((t, i) => (t.length < MIN_TEXT_CHARS ? i : -1)).filter((i) => i >= 0)
    : [];
  let complete = true;
  for (let n = 0; n < scanned.length; n++) {
    if (isCancelled()) {
      complete = false;
      break;
    }
    const i = scanned[n];
    onProgress({ phase: 'ocr', page: i + 1, total: scanned.length, done: n });
    texts[i] = await ocrPage(engine, doc, i + 1, password);
  }

  if (!password && complete && ocr) {
    try {
      cache.write(JSON.stringify(texts));
    } catch {
      // sem cache, segue
    }
  }
  return texts;
}

async function ocrPage(
  engine: PdfEngineApi,
  doc: PdfDoc,
  page: number,
  password: string | undefined,
): Promise<string> {
  const tmp = new File(Paths.cache, `ocr-${doc.id}-${page}.jpg`);
  try {
    const { base64 } = await engine.renderPage(doc.uri, page, OCR_WIDTH, password);
    tmp.write(base64, { encoding: 'base64' });
    const result = await TextRecognition.recognize(tmp.uri);
    return result.text.replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  } finally {
    try {
      if (tmp.exists) tmp.delete();
    } catch {
      // ignora
    }
  }
}

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Procura `query` em cada página; até 3 trechos por página. */
export function searchTexts(texts: string[], query: string): SearchHit[] {
  const q = fold(query.trim());
  if (!q) return [];
  const hits: SearchHit[] = [];
  texts.forEach((text, i) => {
    const folded = fold(text);
    let idx = folded.indexOf(q);
    let count = 0;
    while (idx !== -1 && count < 3) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + q.length + 40);
      hits.push({
        page: i + 1,
        snippet: (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''),
      });
      count++;
      idx = folded.indexOf(q, idx + q.length);
    }
  });
  return hits;
}

export function clearTextCache(doc: PdfDoc): void {
  try {
    const f = cacheFile(doc);
    if (f.exists) f.delete();
  } catch {
    // ignora
  }
}
