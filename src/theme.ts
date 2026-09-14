import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  primary: string;
  bg: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  inputBg: string;
};

const light: Theme = {
  dark: false,
  primary: '#1976d2',
  bg: '#f3f4f6',
  card: '#ffffff',
  text: '#111111',
  textMuted: '#666666',
  border: '#dddddd',
  danger: '#d32f2f',
  inputBg: '#ffffff',
};

const dark: Theme = {
  dark: true,
  primary: '#1565c0',
  bg: '#121212',
  card: '#1e1e1e',
  text: '#f2f2f2',
  textMuted: '#a0a0a0',
  border: '#333333',
  danger: '#ef5350',
  inputBg: '#2a2a2a',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
