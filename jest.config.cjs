module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/test/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  clearMocks: true,
  restoreMocks: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
