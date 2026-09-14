import { fold, getDocText, searchTexts } from '../src/textIndex';
import type { PdfEngineApi } from '../src/components/PdfEngine';
import type { PdfDoc } from '../src/types';
import TextRecognition from '@react-native-ml-kit/text-recognition';

const fs = require('expo-file-system');

const doc: PdfDoc = {
  id: 'd1',
  name: 'a.pdf',
  uri: 'file:///doc/pdfs/d1/a.pdf',
  size: 10,
  addedAt: 0,
  openedAt: 0,
  lastPage: 1,
  totalPages: 0,
  bookmarks: [],
};

function engineWith(texts: string[]): PdfEngineApi {
  return {
    extractText: jest.fn(async (_u, _p, onProgress) => {
      onProgress?.(texts.length, texts.length);
      return texts;
    }),
    renderPage: jest.fn(async () => ({ base64: 'AAAA', width: 10, height: 10 })),
    getOutline: jest.fn(async () => []),
    getLinks: jest.fn(async () => []),
  };
}

beforeEach(() => fs.__reset());

describe('fold', () => {
  it('remove acentos e caixa', () => {
    expect(fold('Ação Ímpar É')).toBe('acao impar e');
  });
});

describe('searchTexts', () => {
  const texts = ['Contrato de locação residencial', 'Cláusula segunda: o valor do aluguel', ''];

  it('ignora acentos e caixa', () => {
    const hits = searchTexts(texts, 'LOCACAO');
    expect(hits).toEqual([{ page: 1, snippet: 'Contrato de locação residencial' }]);
  });

  it('limita a 3 trechos por página e usa reticências', () => {
    const long =
      'x '.repeat(100) + 'alvo ' + 'y '.repeat(50) + 'alvo ' + 'z '.repeat(50) + 'alvo alvo alvo';
    const hits = searchTexts([long], 'alvo');
    expect(hits).toHaveLength(3);
    expect(hits[0].snippet.startsWith('…')).toBe(true);
    expect(hits[0].snippet.endsWith('…')).toBe(true);
  });

  it('retorna vazio para consulta vazia ou sem ocorrência', () => {
    expect(searchTexts(texts, '   ')).toEqual([]);
    expect(searchTexts(texts, 'inexistente')).toEqual([]);
  });
});

describe('getDocText', () => {
  it('usa OCR apenas nas páginas sem texto e cacheia', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValue({ text: 'texto  via\nOCR' });
    const engine = engineWith(['Página com texto suficiente aqui', '']);
    const progress: unknown[] = [];

    const texts = await getDocText(
      engine,
      doc,
      undefined,
      (p) => progress.push(p),
      () => false,
    );

    expect(texts).toEqual(['Página com texto suficiente aqui', 'texto via OCR']);
    expect(engine.renderPage).toHaveBeenCalledTimes(1);
    expect(engine.renderPage).toHaveBeenCalledWith(doc.uri, 2, expect.any(Number), undefined);
    expect(progress.some((p) => (p as { phase: string }).phase === 'ocr')).toBe(true);

    // segunda chamada vem do cache: engine não é chamado de novo
    const again = await getDocText(
      engine,
      doc,
      undefined,
      () => {},
      () => false,
    );
    expect(again).toEqual(texts);
    expect(engine.extractText).toHaveBeenCalledTimes(1);
  });

  it('não cacheia quando há senha', async () => {
    const engine = engineWith(['Documento protegido com texto']);
    await getDocText(
      engine,
      doc,
      'senha',
      () => {},
      () => false,
    );
    await getDocText(
      engine,
      doc,
      'senha',
      () => {},
      () => false,
    );
    expect(engine.extractText).toHaveBeenCalledTimes(2);
  });

  it('cancelamento interrompe OCR e não grava cache', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValue({ text: 'ocr' });
    const engine = engineWith(['', '', '']);
    let calls = 0;
    const texts = await getDocText(
      engine,
      doc,
      undefined,
      () => {},
      () => ++calls > 1,
    );
    expect(engine.renderPage).toHaveBeenCalledTimes(1);
    expect(texts[0]).toBe('ocr');
    expect(texts[1]).toBe('');
    const again = await getDocText(
      engine,
      doc,
      undefined,
      () => {},
      () => false,
    );
    expect(engine.extractText).toHaveBeenCalledTimes(2);
    expect(again).toHaveLength(3);
  });

  it('OCR que falha vira string vazia', async () => {
    (TextRecognition.recognize as jest.Mock).mockRejectedValue(new Error('boom'));
    const engine = engineWith(['']);
    const texts = await getDocText(
      engine,
      doc,
      undefined,
      () => {},
      () => false,
    );
    expect(texts).toEqual(['']);
  });
});
