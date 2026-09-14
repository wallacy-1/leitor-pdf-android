// Ajustes no build.gradle gerado pelo prebuild (idempotente, roda após `expo prebuild --clean`):
//  - signing de release lendo android/keystore.properties
//  - versionCode derivado do git (rev-list --count) — monotônico, sem passo manual
//  - splits por ABI no release (um APK por arquitetura); AAB (bundleRelease) não é afetado
const fs = require('fs');
const path = require('path');

const gradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(gradle)) {
  console.log('[patch-gradle] build.gradle ausente, pulando');
  process.exit(0);
}
let s = fs.readFileSync(gradle, 'utf8');
if (s.includes('keystoreProps')) {
  console.log('[patch-gradle] já aplicado');
  process.exit(0);
}

const debugBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;
if (!s.includes(debugBlock)) {
  console.error('[patch-gradle] bloco signingConfigs não encontrado — template mudou?');
  process.exit(1);
}
s = s.replace(
  debugBlock,
  `    // Release: lê android/keystore.properties (não versionado). Sem ele, cai no debug.keystore.
    def keystorePropsFile = rootProject.file("keystore.properties")
    def keystoreProps = new Properties()
    if (keystorePropsFile.exists()) {
        keystoreProps.load(new FileInputStream(keystorePropsFile))
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropsFile.exists()) {
                storeFile rootProject.file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }`,
);
s = s.replace(
  /(release \{\n(?:\s*\/\/.*\n)*)\s*signingConfig signingConfigs\.debug/,
  `$1            signingConfig keystorePropsFile.exists() ? signingConfigs.release : signingConfigs.debug`,
);
// versionCode = número de commits (fallback 1 fora de um repo git). versionName vem do app.json via prebuild.
s = s.replace(
  /\n(\s*)versionCode 1\n/,
  [
    '',
    '$1// versionCode automático: contagem de commits do git (ver scripts/patch-gradle.js)',
    '$1def gitVersionCode = {',
    '$1    try {',
    '$1        def out = "git rev-list --count HEAD".execute(null, rootProject.projectDir).text.trim()',
    '$1        return out ? out.toInteger() : 1',
    '$1    } catch (Exception e) {',
    '$1        return 1',
    '$1    }',
    '$1}',
    '$1versionCode gitVersionCode()',
    '',
  ].join('\n'),
);

// Splits por ABI só em assembleRelease; debug/emulador e AAB continuam universais.
s = s.replace(
  /\n(\s*)packagingOptions \{/,
  [
    '',
    '$1def taskNames = gradle.startParameter.taskNames.collect { it.toLowerCase() }',
    "$1def abiSplitEnabled = taskNames.any { it.contains('assemblerelease') }",
    '$1splits {',
    '$1    abi {',
    '$1        enable abiSplitEnabled',
    '$1        reset()',
    "$1        include(*(findProperty('reactNativeArchitectures') ?: 'armeabi-v7a,arm64-v8a').split(','))",
    '$1        universalApk false',
    '$1    }',
    '$1}',
    '$1packagingOptions {',
  ].join('\n'),
);

fs.writeFileSync(gradle, s);
console.log('[patch-gradle] ok');
