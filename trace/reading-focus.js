(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReadingFocus = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  // Index the existing blocks; never copy, filter, or mutate the manuscript.
  function createIndex(doc, core) {
    const blocks = new Map(), tags = new Map(), citations = new Map();
    const listRoles = ['ordered-item', 'unordered-item', 'description-item'];
    function visit(nodes, inherited = new Set()) {
      nodes.forEach(block => {
        const own = block.tags || [], effective = new Set(inherited);
        // A sentence's explicit list role overrides its paragraph's list role.
        if (own.some(t => listRoles.includes(t))) listRoles.forEach(t => effective.delete(t));
        own.forEach(t => effective.add(t));
        blocks.set(block.id, effective);
        if (block.type === 'sentence') citations.set(block.id, core.citationSources(doc, block).map(s => s.id));
        // Heading is a role of the heading itself, not of all prose beneath it.
        const childTags = new Set(effective); childTags.delete('heading');
        visit(block.children || [], childTags);
      });
    }
    visit(doc.blocks);
    core.tagNodes(doc).forEach(({ tag }) => tags.set(tag.id, core.descendants(doc, tag.id)));
    function match(tagId, visibleIds) {
      const selected = tags.get(tagId) || new Set(), matched = new Set(), sources = new Set();
      for (const id of new Set(visibleIds)) {
        if ([...(blocks.get(id) || [])].some(t => selected.has(t))) {
          matched.add(id);
          (citations.get(id) || []).forEach(source => sources.add(source));
        }
      }
      return { blocks: matched, sources, count: matched.size };
    }
    return { match };
  }
  return { createIndex };
});
