import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

/**
 * WebView oculta rodando pdf.js. Serve para tudo que o render nativo não faz:
 * extração de texto (busca), render de página em imagem (OCR / miniatura de PDF protegido).
 * O PDF é lido direto do diretório do app via XHR file://.
 */
export type PdfEngineApi = {
  /** Texto de cada página (índice 0 = página 1). */
  extractText: (
    uri: string,
    password: string | undefined,
    onProgress?: (page: number, total: number) => void,
  ) => Promise<string[]>;
  /** Renderiza uma página em JPEG base64. `maxWidth` limita a largura em px. */
  renderPage: (
    uri: string,
    page: number,
    maxWidth: number,
    password?: string,
  ) => Promise<{ base64: string; width: number; height: number }>;
  /** Sumário (outline) do PDF, achatado com nível de indentação. */
  getOutline: (uri: string, password?: string) => Promise<OutlineItem[]>;
  /** Links (anotações) de uma página, com retângulo normalizado 0..1 (origem canto superior esquerdo). */
  getLinks: (uri: string, page: number, password?: string) => Promise<PdfLink[]>;
};

export type OutlineItem = { title: string; page: number; depth: number };
export type PdfLink = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  url?: string;
  page?: number;
};

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (page: number, total: number) => void;
};

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<script src="file:///android_asset/pdfjs/pdf.min.js"></script>
</head><body><canvas id="c"></canvas><script>
pdfjsLib.GlobalWorkerOptions.workerSrc = 'file:///android_asset/pdfjs/pdf.worker.min.js';
var post = function (o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); };
var docCache = { key: null, pdf: null };

function readFile(uri) {
  return new Promise(function (res, rej) {
    var x = new XMLHttpRequest();
    x.open('GET', uri, true);
    x.responseType = 'arraybuffer';
    x.onload = function () { res(x.response); };
    x.onerror = function () { rej(new Error('Falha ao ler arquivo')); };
    x.send();
  });
}

async function openDoc(uri, password) {
  var key = uri + '|' + (password || '');
  if (docCache.key === key && docCache.pdf) return docCache.pdf;
  if (docCache.pdf) { try { docCache.pdf.destroy(); } catch (e) {} }
  var buf = await readFile(uri);
  // isEvalSupported:false — mitigação da CVE-2024-4367 (JS arbitrário via fontes) nesta versão do pdf.js.
  var pdf = await pdfjsLib.getDocument({ data: buf, password: password || undefined, isEvalSupported: false }).promise;
  docCache = { key: key, pdf: pdf };
  return pdf;
}

window.__extractText = async function (id, uri, password) {
  try {
    var pdf = await openDoc(uri, password);
    var texts = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var tc = await page.getTextContent();
      texts.push(tc.items.map(function (i) { return i.str; }).join(' ').replace(/\\s+/g, ' ').trim());
      if (p % 5 === 0 || p === pdf.numPages) post({ id: id, type: 'progress', page: p, total: pdf.numPages });
    }
    post({ id: id, type: 'result', value: texts });
  } catch (e) {
    post({ id: id, type: 'error', message: String((e && e.message) || e) });
  }
};

window.__renderPage = async function (id, uri, pageNum, maxWidth, password) {
  try {
    var pdf = await openDoc(uri, password);
    var page = await pdf.getPage(pageNum);
    var vp0 = page.getViewport({ scale: 1 });
    var scale = Math.min(maxWidth / vp0.width, 4);
    var vp = page.getViewport({ scale: scale });
    var canvas = document.getElementById('c');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    post({ id: id, type: 'result', value: { base64: dataUrl.split(',')[1], width: canvas.width, height: canvas.height } });
  } catch (e) {
    post({ id: id, type: 'error', message: String((e && e.message) || e) });
  }
};
window.__getOutline = async function (id, uri, password) {
  try {
    var pdf = await openDoc(uri, password);
    var outline = (await pdf.getOutline()) || [];
    var flat = [];
    async function walk(items, depth) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var page = null;
        try {
          var dest = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest;
          if (dest && dest[0]) page = (await pdf.getPageIndex(dest[0])) + 1;
        } catch (e) {}
        if (page) flat.push({ title: (it.title || '').trim() || '(sem título)', page: page, depth: depth });
        if (it.items && it.items.length) await walk(it.items, depth + 1);
      }
    }
    await walk(outline, 0);
    post({ id: id, type: 'result', value: flat });
  } catch (e) {
    post({ id: id, type: 'error', message: String((e && e.message) || e) });
  }
};
window.__getLinks = async function (id, uri, pageNum, password) {
  try {
    var pdf = await openDoc(uri, password);
    var page = await pdf.getPage(pageNum);
    var vp = page.getViewport({ scale: 1 });
    var annots = await page.getAnnotations();
    var links = [];
    for (var i = 0; i < annots.length; i++) {
      var a = annots[i];
      if (a.subtype !== 'Link') continue;
      var r = vp.convertToViewportRectangle(a.rect);
      var link = {
        x0: Math.min(r[0], r[2]) / vp.width, y0: Math.min(r[1], r[3]) / vp.height,
        x1: Math.max(r[0], r[2]) / vp.width, y1: Math.max(r[1], r[3]) / vp.height
      };
      if (a.url) link.url = a.url;
      else if (a.dest) {
        try {
          var dest = typeof a.dest === 'string' ? await pdf.getDestination(a.dest) : a.dest;
          if (dest && dest[0]) link.page = (await pdf.getPageIndex(dest[0])) + 1;
        } catch (e) {}
      }
      if (link.url || link.page) links.push(link);
    }
    post({ id: id, type: 'result', value: links });
  } catch (e) {
    post({ id: id, type: 'error', message: String((e && e.message) || e) });
  }
};
post({ type: 'ready' });
</script></body></html>`;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const CALL_TIMEOUT_MS = 5 * 60 * 1000; // OCR/extração de docs grandes podem levar minutos

const EngineContext = createContext<PdfEngineApi | null>(null);

export function usePdfEngine(): PdfEngineApi {
  const api = useContext(EngineContext);
  if (!api) throw new Error('PdfEngineProvider ausente');
  return api;
}

/**
 * Estado mutável do engine fora do ciclo de render (fila, pendências, sinal de pronto).
 * Uma operação por vez: o WebView tem um único documento aberto (docCache) e destruí-lo
 * no meio de outra chamada quebra tudo. Timeout evita promessa pendurada se o renderer morrer.
 */
class EngineCore {
  private pending = new Map<number, Pending>();
  private seq = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private gate = deferred();

  constructor(private web: React.RefObject<WebView | null>) {}

  call<T>(
    fn: string,
    args: unknown[],
    onProgress?: (page: number, total: number) => void,
    timeoutMs = CALL_TIMEOUT_MS,
  ): Promise<T> {
    const run = () =>
      new Promise<T>((resolve, reject) => {
        const id = ++this.seq;
        const timer = setTimeout(() => {
          if (this.pending.delete(id)) reject(new Error('Tempo esgotado processando o PDF.'));
        }, timeoutMs);
        this.pending.set(id, {
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v as T);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
          onProgress,
        });
        this.gate.promise.then(() => {
          const js = `${fn}(${[id, ...args].map((a) => JSON.stringify(a ?? null)).join(', ')}); true;`;
          this.web.current?.injectJavaScript(js);
        });
      });
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  onMessage(data: string): void {
    let msg: { id?: number; type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      this.gate.resolve();
      return;
    }
    const p = msg.id != null ? this.pending.get(msg.id) : undefined;
    if (!p) return;
    if (msg.type === 'progress') {
      p.onProgress?.(msg.page as number, msg.total as number);
    } else if (msg.type === 'result') {
      this.pending.delete(msg.id!);
      p.resolve(msg.value);
    } else if (msg.type === 'error') {
      this.pending.delete(msg.id!);
      p.reject(new Error(String(msg.message)));
    }
  }

  /** Renderer morto (geralmente OOM): falha tudo que está pendente e volta a esperar 'ready'. */
  onRendererGone(): void {
    for (const p of this.pending.values()) {
      p.reject(new Error('O processador de PDF foi encerrado (memória insuficiente?).'));
    }
    this.pending.clear();
    this.gate = deferred();
  }

  api(): PdfEngineApi {
    return {
      extractText: (uri, password, onProgress) =>
        this.call<string[]>('window.__extractText', [uri, password], onProgress),
      renderPage: (uri, page, maxWidth, password) =>
        this.call('window.__renderPage', [uri, page, maxWidth, password]),
      getOutline: (uri, password) =>
        this.call<OutlineItem[]>('window.__getOutline', [uri, password]),
      getLinks: (uri, page, password) =>
        this.call<PdfLink[]>('window.__getLinks', [uri, page, password]),
    };
  }
}

export function PdfEngineProvider({ children }: { children: React.ReactNode }) {
  const web = useRef<WebView>(null);
  const [core] = useState(() => new EngineCore(web));
  const api = useMemo(() => core.api(), [core]);

  return (
    <EngineContext.Provider value={api}>
      {children}
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          ref={web}
          originWhitelist={['file://*']}
          source={{ html: HTML, baseUrl: 'file:///android_asset/' }}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          onMessage={(e: WebViewMessageEvent) => core.onMessage(e.nativeEvent.data)}
          onRenderProcessGone={() => {
            core.onRendererGone();
            web.current?.reload();
          }}
        />
      </View>
    </EngineContext.Provider>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
});
