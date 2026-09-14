// Mocks de módulos nativos usados por src/storage.ts e src/textIndex.ts.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-pdf-thumbnail', () => ({
  __esModule: true,
  default: { generate: jest.fn() },
}));
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: { recognize: jest.fn() },
}));
