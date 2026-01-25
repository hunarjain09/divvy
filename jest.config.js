module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@/logic/(.*)$': '<rootDir>/src/logic/$1',
    '^@/db$': '<rootDir>/src/db.js',
  },
  transform: {
    '^.+\\.(jsx?|tsx?)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/db.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/tests/**/*.test.js'],
};
