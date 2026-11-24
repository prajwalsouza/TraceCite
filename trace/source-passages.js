// Stub of Trace's SourcePassages: same interface, no paper-specific correction.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.SourcePassages = api; })(globalThis, function () {
  'use strict';
  const apply = (doc) => doc;
  const presentation = () => ({ complete: false, label: 'SOURCE EXCERPT', conflict: '' });
  return { apply, presentation, correction: null };
});
