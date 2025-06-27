import { createDefaultPreset } from 'ts-jest';

export default {
  ...createDefaultPreset(),
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 0,
    },
  },
};
