// eslint-disable-next-line no-undef
module.exports = {
  transform: {
    '^.+\\.tsx?$': 'esbuild-jest',
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  // transform: {
  //   '^.+\\.(ts|tsx)$': 'ts-jest',
  // },
};
