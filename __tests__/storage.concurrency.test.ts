import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cleanupOcrTemp,
  findDuplicate,
  importPdfFromUrl,
  loadRecents,
  mutateRecents,
  normalize,
  saveRecents,
  updateDoc,
} from '../src/storage';

const fs = require('expo-file-system');

beforeEach(async () => {
  fs.__reset();
  await AsyncStorage.clear();
});

describe('escritas concorrentes', () => {
  it('updateDoc em paralelo não perde nenhum campo', async () => {
    await saveRecents([normalize({ id: '1', name: 'a', uri: 'u' })]);
    await Promise.all([
      updateDoc('1', { lastPage: 9 }),
      updateDoc('1', { thumbUri: 'file:///t.jpg' }),
      updateDoc('1', { bookmarks: [3] }),
      mutateRecents((docs) => [normalize({ id: '2', name: 'b', uri: 'u' }), ...docs]),
    ]);
    const docs = await loadRecents();
    expect(docs).toHaveLength(2);
    expect(docs.find((d) => d.id === '1')).toMatchObject({
      lastPage: 9,
      thumbUri: 'file:///t.jpg',
      bookmarks: [3],
    });
  });

  it('erro em uma escrita não trava a fila', async () => {
    await expect(
      mutateRecents(() => {
        throw new Error('x');
      }),
    ).rejects.toThrow('x');
    await updateDoc('nada', {});
    expect(await loadRecents()).toEqual([]);
  });
});

describe('findDuplicate sem tamanho', () => {
  it('size 0 nunca casa (tamanho desconhecido)', () => {
    const a = normalize({ id: 'a', name: 'x.pdf', uri: 'u', size: 0 });
    expect(findDuplicate([a], { name: 'x.pdf', size: 0 })).toBeUndefined();
  });
});

describe('cleanupOcrTemp', () => {
  it('remove só ocr-*.jpg do cache', () => {
    new fs.File(fs.Paths.cache, 'ocr-1-2.jpg').write('x');
    new fs.File(fs.Paths.cache, 'outro.jpg').write('x');
    cleanupOcrTemp();
    expect(new fs.File(fs.Paths.cache, 'ocr-1-2.jpg').exists).toBe(false);
    expect(new fs.File(fs.Paths.cache, 'outro.jpg').exists).toBe(true);
  });
});

describe('importPdfFromUrl', () => {
  const pdfBytes = new TextEncoder().encode('%PDF-1.4 conteudo');
  const mockFetch = (init: {
    ok?: boolean;
    status?: number;
    length?: string;
    body?: Uint8Array;
  }) => {
    globalThis.fetch = jest.fn(async () => ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      headers: { get: (k: string) => (k === 'content-length' ? (init.length ?? null) : null) },
      arrayBuffer: async () => (init.body ?? pdfBytes).buffer,
    })) as unknown as typeof fetch;
  };

  it('rejeita http', async () => {
    await expect(importPdfFromUrl('http://x.com/a.pdf')).rejects.toThrow(/https/);
  });

  it('baixa, valida cabeçalho e grava em pdfs/<id>/', async () => {
    mockFetch({});
    const doc = await importPdfFromUrl('https://x.com/dir/Rel.pdf?dl=1');
    expect(doc.name).toBe('Rel.pdf');
    expect(doc.size).toBe(pdfBytes.byteLength);
    expect(new fs.File(doc.uri).exists).toBe(true);
  });

  it('rejeita não-PDF e não deixa lixo', async () => {
    mockFetch({ body: new TextEncoder().encode('<html>') });
    await expect(importPdfFromUrl('https://x.com/a.pdf')).rejects.toThrow(/não retornou um PDF/);
    expect([...fs.__files.keys()].some((k: string) => k.includes('/pdfs/'))).toBe(false);
  });

  it('rejeita por content-length acima do limite antes de baixar', async () => {
    mockFetch({ length: String(200 * 1024 * 1024) });
    await expect(importPdfFromUrl('https://x.com/a.pdf')).rejects.toThrow(/100 MB/);
  });

  it('rejeita status de erro', async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(importPdfFromUrl('https://x.com/a.pdf')).rejects.toThrow(/404/);
  });
});
