import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { applyTheme, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/settings';

beforeEach(() => AsyncStorage.clear());

describe('settings', () => {
  it('padrão quando vazio; merge parcial persiste', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ theme: 'dark' });
    const s = await saveSettings({ ocr: false });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', ocr: false });
    expect(await loadSettings()).toEqual(s);
  });

  it('escritas concorrentes não se perdem', async () => {
    await Promise.all([saveSettings({ keepAwake: false }), saveSettings({ confirmLinks: false })]);
    expect(await loadSettings()).toMatchObject({ keepAwake: false, confirmLinks: false });
  });

  it('JSON inválido cai no padrão', async () => {
    await AsyncStorage.setItem('@leitor-pdf/settings', '{');
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('applyTheme mapeia system -> unspecified', () => {
    const spy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    applyTheme('system');
    applyTheme('dark');
    expect(spy.mock.calls).toEqual([['unspecified'], ['dark']]);
    spy.mockRestore();
  });
});
