(function (global) {
  'use strict';

  function escapeHTML(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  global.LFdCSecurity = Object.freeze({ escapeHTML: escapeHTML });
})(typeof window !== 'undefined' ? window : globalThis);
