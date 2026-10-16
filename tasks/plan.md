# Implementation Plan: External HTML in Flex Page Builder

## Overview

Let administrators opt in to importing existing page HTML into Flex Page Builder as separately selectable visual units. Preserve the current native builder workflow. Allow safe leaf text edits while keeping imported visual markup intact; native block conversion remains a later phase.

## Architecture Decisions

- Keep the feature behind the existing `allow_html_import` setting; disabled remains the default and preserves current behavior.
- Start with passive HTML fragments. If a document contains executable or active constructs that the builder cannot round-trip safely (scripts, inline event handlers, forms, embedded documents, or PHP source), keep it as one opaque HTML block and explain why it was not decomposed.
- Parse and decompose on the client using the browser DOM parser. Use imported HTML groups as DOM-preserving containers for nested HTML elements, with the existing selection/removal APIs. This avoids a new server parser dependency.
- Do not reinterpret arbitrary visual markup as native builder controls. Imported blocks remain structurally opaque and deletable; supported leaf text can be edited in place, while adding native blocks among imported blocks remains a later phase.
- Never execute imported markup as part of the editor canvas. Keep the existing server-side HTML cleaning rules.

## Task List

### Phase 1: Safe visual import and deletion
- [x] Expose the opt-in setting and import state to the page editor.
- [x] Split safe imported HTML into separately named top-level visual blocks, retaining IDs for stable selection.
- [x] Keep active or executable documents opaque, sanitize them for preview, show a clear notice, and disable save until the opaque block is intentionally removed.
- [ ] Verify block selection, deletion, save/reload, the disabled setting, and the native builder flow.

### Checkpoint: Phase 1
- [x] JavaScript and PHP syntax checks succeed; plugin manifest and locale JSON are valid.
- [ ] Review round-trip behavior for passive HTML and safe fallback behavior for active HTML.

### Phase 2: Safe text editing
- [x] Identify leaf text regions in supported HTML tags and make only those regions editable in the preview.
- [x] Persist text edits through the existing HTML field after removing editor-only preview attributes.
- [ ] Verify edited text survives save/reload and that the surrounding design remains intact.

### Phase 3: Mixed native and imported content
- [x] Preserve imported wrapper elements as nested groups with separately selectable child HTML nodes.
- [x] Render child nodes in their original DOM positions without adding layout wrappers.
- [ ] Allow and verify native Page Builder blocks before, between, and after imported blocks.
- [ ] Verify deletion, reorder, save, and preview while preserving imported HTML.

### Phase 4: Compatibility and hardening
- [ ] Cover nested markup, styles, links, media, malformed HTML, scripts, and PHP-rendered content.
- [ ] Document supported import behavior and safe limitations.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Recompiling imported HTML changes selectors or layout | High | Keep each imported top-level root opaque and preserve its markup; verify round-trip in preview and public output. |
| Scripts or event handlers are stripped by the compiler | High | Do not split active documents in Phase 1; keep them opaque and avoid claiming they are safely editable. |
| Malformed markup parses differently across browsers | Medium | Use the platform browser DOM parser and retain a safe opaque fallback when no usable roots are found. |
| Admin page content contains PHP source | High | Clarify that the editor receives rendered HTML; PHP source is not available through the page content API. |

## Open Questions

- Later phases may need a separate trusted-code preservation policy. Phase 1 does not execute or expose scripts as visual elements.
