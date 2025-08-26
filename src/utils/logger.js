/* Proxy to unified utils to avoid duplication */
'use strict';

// Export the Logger constructor directly as the module's default export so that
// `import Logger from '../../utils/logger.js'` yields a constructable class.
try {
  const utils = require('./index.js');
  module.exports = utils.Logger;
} catch (e) {
  // Fallback for browser context without CommonJS
  if (typeof window !== 'undefined' && window.SCPUtils && window.SCPUtils.Logger) {
    module.exports = window.SCPUtils.Logger;
  }
}