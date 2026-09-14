import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PREFS, loadPrefs, savePrefs } from '../src/prefs';

beforeEach(() => AsyncStorage.clear());

describe('prefs', () => {
  it('padrão quando não há nada salvo', async () => {
    expect(await loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('save faz merge parcial e persiste', async () => {
    await savePrefs({ night: true });
    const p = await savePrefs({ fitPolicy: 2 });

    expect(p).toEqual({ horizontal: false, night: true, fitPolicy: 2 });
    expect(DEFAULT_PREFS.fitPolicy).toBe(2);
    expect(await loadPrefs()).toEqual(p);
  });

  it('JSON inválido cai no padrão', async () => {
    await AsyncStorage.setItem('@leitor-pdf/prefs', '???');
    expect(await loadPrefs()).toEqual(DEFAULT_PREFS);
  });
});
