/**
 * Async Handler Middleware Wrapper
 * 
 * Automatically catches errors from async route handlers
 * and passes them to the Express error middleware via next()
 * 
 * Usage:
 * export const getLeader = asyncHandler(async (req, res) => {
 *   const leader = await leaderService.getLeader(req.params.id);
 *   res.json(leader);
 * });
 * 
 * Benefits:
 * - No need for try-catch in every controller
 * - Consistent error handling
 * - Prevents unhandled promise rejections
 * - All errors automatically sent to error.middleware
 * 
 */

/**
 * Wraps an async route handler to catch errors
 * @param {Function} fn - Async route handler (req, res, next) => Promise
 * @returns {Function} Express route handler with error catching
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
