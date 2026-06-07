# Design Review: Editor Theme & Contrast

**Review ID:** editor-theme_20250607  
**Reviewed:** 2025-06-07  
**Target:** `src/theme/apply.ts`, `src/win32/charformat.ts`, `src/highlight/*`, `themes/*.json`  
**Focus:** Visual design, usability (contrast), code quality

## Summary

The editor appeared unreadable on dark themes because RichEdit character formatting used an incorrect `CHARFORMAT2` layout, fonts were created without monospace/ClearType flags, and extensionless buffers (e.g. `bunpad.exe`) never received syntax highlighting. Fixes applied to formatting pipeline, font creation, content-based language detection, and dark theme token/menu colors.

**Issues Found:** 5 (4 fixed, 1 suggestion open)

## Critical Issues (Fixed)

### Issue 1: CHARFORMAT2 color at wrong offset

**Severity:** Critical  
**Location:** `src/win32/charformat.ts`  
**Category:** Visual

**Problem:** `crTextColor` was written at offset 16 instead of 20; RichEdit ignored custom colors and kept system default (near-black on dark background).

**Fix:** Centralized packing in `charformat.ts` with correct offsets, `CFM_*` masks, and `CFE_AUTOCOLOR` cleared.

### Issue 2: WM_SETFONT reset formatting order

**Severity:** Critical  
**Location:** `src/theme/apply.ts`  
**Category:** Visual

**Problem:** `EM_SETCHARFORMAT` ran before `WM_SETFONT`, so font changes could override color/face.

**Fix:** Apply background → font → `SCF_ALL` charformat (in that order).

### Issue 3: Highlight layer skipped base format

**Severity:** Major  
**Location:** `src/highlight/controller.ts`  
**Category:** Visual

**Problem:** Syntax highlighting only set selection-scoped colors without re-establishing base editor format after `WM_SETTEXT`.

**Fix:** `applyBaseFormat()` runs `SCF_ALL` before token passes on full-document highlights.

### Issue 4: Plain Text for TypeScript content

**Severity:** Major  
**Location:** `src/highlight/detect.ts`  
**Category:** Usability

**Problem:** Files without extensions (e.g. `bunpad.exe`) stayed on plain grammar — no token colors.

**Fix:** `detectLanguageFromContent()` sniffs imports/exports for TypeScript, etc.

## Suggestions

### Suggestion 1: Theme scrollbar styling

Native Win32 scrollbars remain system-themed (white). Custom scrollbar theming would require non-client painting or a different editor surface.

## Positive Observations

- Theme JSON structure separates `editor`, `ui`, and `tokens` cleanly
- Custom menu bar/status bar already use theme tokens
- Incremental highlighting architecture is sound once base format is correct

## Next Steps

1. Rebuild: `bun run build`
2. Verify Nord/Dark/Dracula with `bunpad .\src\index.ts`
3. Consider Solarized token pass if muted palette still feels low-contrast
