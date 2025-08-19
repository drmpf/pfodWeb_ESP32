// Shared constants to avoid circular dependencies
  var JS_VERSION = "V1.1.0 -- 17th August 2025";

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.JS_VERSION = JS_VERSION;
}

// Export for Node.js use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JS_VERSION };
}