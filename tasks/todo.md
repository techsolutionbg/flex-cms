# Flex Page Builder: external HTML task list

## Phase 1: Safe visual import and deletion
- [x] Return `allow_html_import` with the editor document and gate decomposition on it.
- [x] Add a client-side parser that preserves safe top-level roots and exposes their nested HTML descendants as separate items.
- [x] Label imported elements clearly in the canvas structure and inspector.
- [x] Keep active/executable content opaque, sanitize its preview, and block saving until it is intentionally removed.
- [x] Route selection/removal through existing builder actions.
- [x] Confirm the five homepage sections appear as separate selectable blocks and that selecting one exposes its delete control.
- [ ] Confirm removal, save/reload, disabled-setting behavior, and active-content fallback in the running admin.
- [x] Check JavaScript syntax, PHP syntax, plugin manifest/locales, and whitespace errors.

## Checkpoint
- [ ] Passive markup can be selected and deleted independently.
- [ ] Disabled setting and native builder documents retain existing behavior.
- [ ] Active markup falls back safely without being silently decomposed.

## Later phases
- [x] Make supported leaf text nodes editable directly in the preview without exposing raw HTML controls.
- [x] Preserve imported wrappers while exposing nested HTML descendants as separate tree items.
- [x] Render nested imported nodes in their original DOM positions without adding layout-changing wrappers.
- [ ] Confirm nested selection, deletion, reordering, save, and reload in the running admin.
- [ ] Confirm text edits preserve the containing markup through save/reload.
- [ ] Add native builder elements among imported HTML blocks.
- [ ] Expand import compatibility and document limitations.
