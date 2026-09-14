# Leitor PDF

App Android em React Native (Expo) para leitura de PDFs.

## Funcionalidades

- Abrir PDF pelo seletor (vários de uma vez), por URL, ou via "Abrir com" de qualquer app (intent `application/pdf`, incluindo http/https)
- Lista de recentes com miniatura da capa, progresso, busca por nome, ordenação (recentes / nome / adicionado), renomear
- Visualizador: zoom/pinch, rolagem vertical ou horizontal, ajuste (largura / altura / página), slider de páginas, ir para página
- Tela cheia (toque na página), sumário do PDF, grade de miniaturas de páginas
- Links dentro do PDF (internos e externos, com confirmação) — detecção própria via pdf.js + coordenadas do toque
- Preferências de leitura persistidas (rolagem, ajuste, noturno)
- Imprimir (diálogo do sistema)
- Configurações (⚙ na Home): tema sistema/claro/escuro, rolagem, ajuste de página, modo noturno, tela ligada, OCR automático, confirmação de links, retomar último documento, uso de disco, limpar caches, remover tudo
- Busca de texto no documento (pdf.js em WebView) com salto para a página; páginas escaneadas passam por OCR offline (ML Kit), resultado cacheado
- Marcadores por documento
- Retoma na última página lida
- PDFs protegidos por senha (leitura, busca e miniatura)
- Modo noturno (inversão de cores nativa) e tema claro/escuro seguindo o sistema
- Tela ligada durante a leitura, suporte a landscape
- Compartilhar / remover
- Botão voltar do Android fecha modais e volta para a lista

## Stack

- Expo SDK 57 / React Native 0.86 / TypeScript
- `react-native-pdf` + `react-native-blob-util` (render nativo; patch em `patches/` adiciona prop `nightMode` e coordenadas normalizadas no `onPageSingleTap`)
- `react-native-pdf-thumbnail` (miniaturas; patch em `patches/` para Kotlin recente)
- `react-native-webview` + `pdfjs-dist@3` (extração de texto e render de página; build copiado para `android/app/src/main/assets/pdfjs` no `postinstall`)
- `@react-native-ml-kit/text-recognition` (OCR offline, script latino; patch remove outros scripts para reduzir o APK)
- `@react-native-community/slider`, `expo-print`, `expo-document-picker`, `expo-file-system`, `expo-sharing`, `expo-keep-awake`, `react-native-safe-area-context`

## Rodar

Requer módulos nativos — não funciona no Expo Go. Use dev build:

```bash
npm install
npx expo run:android
```

A pasta `android/` não é versionada (Continuous Native Generation). Gere-a antes do primeiro build e sempre que mudar `app.json`; o script reaplica signing, versionCode e assets do pdf.js:

```bash
npm run prebuild:android
```

## Testes

```bash
npm test
```

Jest (`jest-expo`) cobre a lógica pura: `storage` (normalização, nomes de arquivo, dedupe, recentes), `textIndex` (busca, OCR com cache/cancelamento) e `prefs`. Módulos nativos são mockados em `jest.setup.js` / `__mocks__/`. CI em `.github/workflows/ci.yml` roda tsc + prettier + jest.

## Release

Sem keystore, o release usa a chave de debug (só para testes). Para publicar:

1. Gere a keystore (guarde senha e arquivo — perder = não consegue atualizar o app na loja):

```bash
keytool -genkeypair -v -keystore android/release.keystore -alias leitorpdf -keyalg RSA -keysize 2048 -validity 10000
```

2. Copie `keystore.properties.example` para `android/keystore.properties` e preencha.

3. Versão e build:

```bash
npm run bump -- patch      # atualiza package.json + app.json, commit + tag vX.Y.Z
npm run build:aab          # Play Store (arm64 + armeabi-v7a)
npm run build:apk          # APKs por ABI em android/app/build/outputs/apk/release/
npm run build:apk:emulator # release x86_64 para testar minify no emulador
```

`versionCode` é automático (contagem de commits do git — ver `scripts/patch-gradle.js`); `versionName` vem de `expo.version`. Release usa R8 (minify + shrinkResources) com regras em `app.json` → `expo-build-properties.extraProguardRules`. Tamanho: ~40 MB por ABI (antes: 134 MB universal).

## Estrutura

```
App.tsx                           # Home <-> Viewer, intents de abertura, progresso
src/screens/HomeScreen.tsx        # picker, recentes, busca/ordenação, menu
src/screens/ViewerScreen.tsx      # visualizador, menu, busca, marcadores, senha
src/components/PdfEngine.tsx      # WebView oculta com pdf.js (texto, render, sumário, links)
src/components/PagesGrid.tsx      # grade de miniaturas de páginas
src/components/OutlineModal.tsx   # sumário
src/components/ScreenModal.tsx    # modal full-screen com header
src/textIndex.ts                  # extração + OCR + cache + busca
src/prefs.ts                      # preferências de leitura
src/settings.ts                   # configurações do app (tema via Appearance.setColorScheme)
src/screens/SettingsScreen.tsx    # tela de configurações
src/components/ActionSheet.tsx
src/components/PromptModal.tsx
src/components/RecentItem.tsx
src/storage.ts                    # AsyncStorage + arquivos em pdfs/<id>/
src/theme.ts                      # cores claro/escuro
scripts/copy-pdfjs.js             # copia pdf.js para assets nativos
scripts/patch-gradle.js           # signing, versionCode (git) e splits ABI no build.gradle (pós-prebuild)
scripts/bump.js                   # bump de versão + tag
src/components/ErrorBoundary.tsx  # tela de erro com reiniciar / limpar dados
react-native.config.js            # fix de autolinking do pdf-thumbnail
```

## Segurança e privacidade

- pdf.js roda com `isEvalSupported: false` (mitigação CVE-2024-4367) em WebView restrita a `file://`.
- Links de PDF: só `http(s)` e `mailto`, sempre com confirmação. Download por URL: só https, 100 MB, 60 s, validação `%PDF-`.
- PDFs protegidos: senha só em memória; texto extraído, miniaturas e páginas nunca vão para disco.
- Sem backup automático (`allowBackup=false`); permissões de armazenamento/overlay removidas.

## Notas

- Links: o pdfium usado pela lib nativa não reporta anotações de link neste build; por isso o toque é mapeado para coordenadas da página (patch) e casado com `page.getAnnotations()` do pdf.js.
- Fora de alcance com `react-native-pdf`: seleção/cópia de texto, anotações/highlight, formulários.

- OCR roda na primeira busca de cada documento escaneado (~1 s/página) e fica em cache em `pdfs/<id>/text.json`.
- Texto de PDFs com senha não é cacheado em disco.
- Fechar a tela de busca cancela um OCR em andamento.
