import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fileNameFromUrl,
  findDuplicate,
  importPdf,
  loadRecents,
  normalize,
  removeDocFiles,
  renameDoc,
  safeFileName,
  saveRecents,
  updateDoc,
} from '../src/storage';
import type { PdfDoc } from '../src/types';

const fs = require('expo-file-system');

beforeEach(async () => {
  fs.__reset();
  await AsyncStorage.clear();
});

describe('normalize', () => {
  it('preenche campos ausentes de documentos antigos', () => {
    const d = normalize({ id: '1', name: 'a.pdf', uri: 'file:///a.pdf', addedAt: 100 });
    expect(d).toEqual({
      id: '1',
      name: 'a.pdf',
      uri: 'file:///a.pdf',
      size: 0,
      addedAt: 100,
      openedAt: 100,
      lastPage: 1,
      totalPages: 0,
      bookmarks: [],
    });
  });

  it('não sobrescreve campos existentes', () => {
    const d = normalize({ id: '1', name: 'a', uri: 'u', lastPage: 7, bookmarks: [2, 3] });
    expect(d.lastPage).toBe(7);
    expect(d.bookmarks).toEqual([2, 3]);
  });
});

describe('safeFileName / fileNameFromUrl', () => {
  it('troca caracteres inválidos', () => {
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j.pdf')).toBe('a_b_c_d_e_f_g_h_i_j.pdf');
  });

  it('extrai nome da URL, sem query, com .pdf', () => {
    expect(fileNameFromUrl('https://x.com/docs/Relat%C3%B3rio%20final.PDF?dl=1')).toBe(
      'Relatório final.PDF',
    );
    expect(fileNameFromUrl('https://x.com/download?id=9')).toBe('download.pdf');
    expect(fileNameFromUrl('https://x.com/')).toBe('documento.pdf');
    expect(fileNameFromUrl('https://x.com/%E0%A4%A')).toBe('documento.pdf'); // percent-encoding inválido
  });
});

describe('findDuplicate', () => {
  const a = normalize({ id: 'a', name: 'x.pdf', uri: 'u', size: 10 });
  const b = normalize({ id: 'b', name: 'y.pdf', uri: 'u', size: 10 });

  it('casa por nome e tamanho', () => {
    expect(findDuplicate([a, b], { name: 'y.pdf', size: 10 })).toBe(b);
    expect(findDuplicate([a, b], { name: 'y.pdf', size: 11 })).toBeUndefined();
  });
});

describe('recentes (AsyncStorage)', () => {
  it('load vazio, save/load roundtrip normalizando', async () => {
    expect(await loadRecents()).toEqual([]);
    await AsyncStorage.setItem(
      '@leitor-pdf/recentes',
      JSON.stringify([{ id: '1', name: 'a', uri: 'u' }]),
    );
    const docs = await loadRecents();
    expect(docs[0].bookmarks).toEqual([]);
  });

  it('JSON corrompido vira lista vazia', async () => {
    await AsyncStorage.setItem('@leitor-pdf/recentes', '{nope');
    expect(await loadRecents()).toEqual([]);
  });

  it('updateDoc / renameDoc alteram só o alvo', async () => {
    const docs: PdfDoc[] = [
      normalize({ id: '1', name: 'a', uri: 'u' }),
      normalize({ id: '2', name: 'b', uri: 'u' }),
    ];
    await saveRecents(docs);
    const next = await updateDoc('2', { lastPage: 5, bookmarks: [1] });
    expect(next.find((d) => d.id === '2')).toMatchObject({ lastPage: 5, bookmarks: [1] });
    expect(next.find((d) => d.id === '1')).toMatchObject({ lastPage: 1 });
    const renamed = await renameDoc('1', '  Novo nome  ');
    expect(renamed.find((d) => d.id === '1')?.name).toBe('Novo nome');
  });
});

describe('importPdf / removeDocFiles', () => {
  it('copia para pdfs/<id>/<nome> e remove tudo depois', async () => {
    new fs.File('file:///cache/orig.pdf').write('%PDF-1.4 conteudo');
    const doc = await importPdf('file:///cache/orig.pdf', 'Meu: Arquivo.pdf');
    expect(doc.name).toBe('Meu: Arquivo.pdf');
    expect(doc.uri).toMatch(/^file:\/\/\/doc\/pdfs\/[^/]+\/Meu_ Arquivo\.pdf$/);
    expect(new fs.File(doc.uri).exists).toBe(true);
    removeDocFiles(doc);
    expect(new fs.File(doc.uri).exists).toBe(false);
  });

  it('falha se origem não existe', async () => {
    await expect(importPdf('file:///nada.pdf')).rejects.toThrow(/inacess/);
  });
});
