---
sidebar_position: 2
title: Watermarks
---

# Watermarks

## The problem

You need to mark printed documents as DRAFT, CONFIDENTIAL, or VOID — a visible overlay on every page that communicates the document's status.

## The solution

```intenttext
watermark: DRAFT | color: #cccccc | opacity: 0.06
```

The `watermark:` keyword places rotated text behind the page content on every printed page.

## Common watermarks

### DRAFT

```intenttext
watermark: DRAFT | color: #cccccc | opacity: 0.06
```

Light gray, barely visible. Signals the document isn't final without obscuring content.

### CONFIDENTIAL

```intenttext
watermark: CONFIDENTIAL | color: #999999 | opacity: 0.05 | size: 96pt
```

Larger text for legal emphasis. Still subtle enough to read through.

### VOID

```intenttext
watermark: VOID | color: #ff0000 | opacity: 0.08
```

Red for canceled or invalidated documents. Higher opacity for visibility.

### COPY

```intenttext
watermark: COPY | color: #cccccc | opacity: 0.1
```

Marks printed copies to distinguish from originals.

## Properties

| Property   | Default   | Description                                                                             |
| ---------- | --------- | --------------------------------------------------------------------------------------- |
| `color:`   | `#cccccc` | Any CSS color value                                                                     |
| `opacity:` | `0.1`     | 0–1 range. Keep below 0.15 to maintain readability                                      |
| `angle:`   | `-45`     | Rotation in degrees. -45 is diagonal bottom-left to top-right                           |
| `size:`    | `72pt`    | Font size. Larger for fewer characters (DRAFT), smaller for longer words (CONFIDENTIAL) |

## Opacity guide

| Opacity     | Effect                                                      |
| ----------- | ----------------------------------------------------------- |
| `0.03–0.05` | Very subtle — noticeable but doesn't interfere with reading |
| `0.06–0.10` | Standard — clearly visible, content still readable          |
| `0.10–0.15` | Strong — makes a statement, some content harder to read     |
| `> 0.15`    | Too much — obscures content, not recommended                |

## Removing watermarks

Watermarks are keywords in the `.it` file. To remove them, delete the line. For final versions:

1. Remove `watermark: DRAFT` from the file
2. Re-render: `intenttext document.it --print`

For templates, use a variable:

```intenttext
watermark: {{watermark_text}} | color: {{watermark_color}} | opacity: {{watermark_opacity}}
```

Pass empty data to skip the watermark, or specific values for different versions.

## Render

```bash
intenttext document.it --print --theme corporate
intenttext document.it --pdf --theme legal
```

Watermarks appear in both print HTML and PDF output. They do not appear in standard HTML rendering.

## Next steps

- [Print-Ready Documents](./print-ready-documents) — full print layout
- [PDF Export](./pdf-export) — PDF output with metadata
