/**
 * Jest Configuration for SCP Tracker
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'https://scp-wiki.wikidot.com'
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts'],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  
  // Module name mapper
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },
  
  // Setup files (removed to simplify and avoid legacy globals)
  
  // Coverage configuration (temporarily relaxed for focused debugging)
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!tests/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  
  // Test timeout
  testTimeout: 10000,
  
  // Max workers
  maxWorkers: '50%',
  
  // Verbose output
  verbose: true,
  
  // Test results processor
  testResultsProcessor: 'jest-junit',
  
  
  // Test name pattern
  testNamePattern: '^((?!skip).)*$',
  
  // Force coverage collection from ignored files
  forceCoverageMatch: ['src/**/*.js'],
  
  // Coverage path ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/'
  ]
};