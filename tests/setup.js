/**
 * Jest Setup File
 * 
 * Runs before all tests
 */

// Suppress console logs during tests (optional)
// global.console.log = jest.fn();

// Set test environment
process.env.NODE_ENV = 'test';
process.env.FORCE_EMAIL_MOCK = 'true'; // Use email mock in tests

// MongoDB connection timeout
jest.setTimeout(10000);

// Add custom matchers if needed
expect.extend({
  toBeValidObjectId(received) {
    const valid = /^[0-9a-fA-F]{24}$/.test(received);
    return {
      pass: valid,
      message: () => valid
        ? `expected ${received} not to be a valid MongoDB ObjectId`
        : `expected ${received} to be a valid MongoDB ObjectId`
    };
  }
});
