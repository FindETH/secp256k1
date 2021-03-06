module.exports = {
  roots: ['src/'],
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['**/*.ts?(x)', '!**/*.d.ts'],
  snapshotResolver: './jest/snapshotResolver.js',
  transform: {
    '^.+\\.[t|j]sx?$': 'babel-jest'
  }
};
