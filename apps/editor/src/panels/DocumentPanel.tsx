import { useState, useEffect } from "react";
import type { DocumentMeta } from "../hooks/useDocumentMeta";

/* ─── Font options ─────────────────────────────────────────── */
const SERIF_FONTS = ["Georgia", "Times New Roman", "Palatino", "Garamond"];
const SANS_FONTS = ["Inter", "Helvetica", "Arial", "Verdana", "Trebuchet MS"];
const MONO_FONTS = ["JetBrains Mono", "Courier New", "Menlo", "Fira Code"];
const SIZES = ["10pt", "11pt", "12pt", "14pt", "16pt", "18pt"];
const LEADINGS = ["1.2", "1.4", "1.5", "1.6", "1.8", "2.0"];
const PAGE_SIZES = ["A4", "A5", "Letter", "Legal"];

interface Props {
  meta: DocumentMeta;
  onTitleChange: (v: string) => void;
  onSummaryChange: (v: string) => void;
  onBylineChange: (author: string, publication: string, date: string) => void;
  onFontChange: (
    family: string,
    size: string,
    leading: string,
    heading: string,
    mono: string,
  ) => void;
  onPageChange: (
    size: string,
    orientation: string,
    margins: string,
    columns: string,
    gap: string,
  ) => void;
  onHeaderChange: (v: string) => void;
  onFooterChange: (v: string) => void;
  onWatermarkChange: (
    text: string,
    opacity: string,
    angle: string,
    color: string,
  ) => void;
  onTocChange: (enabled: boolean, title: string, depth: string) => void;
}

export function DocumentPanel({
  meta,
  onTitleChange,
  onSummaryChange,
  onBylineChange,
  onFontChange,
  onPageChange,
  onHeaderChange,
  onFooterChange,
  onWatermarkChange,
  onTocChange,
}: Props) {
  // Local state synced from meta
  const [title, setTitle] = useState(meta.title);
  const [summary, setSummary] = useState(meta.summary);
  const [author, setAuthor] = useState(meta.author);
  const [publication, setPublication] = useState(meta.publication);
  const [date, setDate] = useState(meta.date);
  const [fontFamily, setFontFamily] = useState(meta.fontFamily);
  const [fontSize, setFontSize] = useState(meta.fontSize);
  const [fontLeading, setFontLeading] = useState(meta.fontLeading);
  const [headingFont, setHeadingFont] = useState(meta.headingFont);
  const [monoFont, setMonoFont] = useState(meta.monoFont);
  const [pageSize, setPageSize] = useState(meta.pageSize);
  const [pageOrientation, setPageOrientation] = useState(meta.pageOrientation);
  const [margins, setMargins] = useState(meta.marginTop);
  const [columns, setColumns] = useState(meta.columns);
  const [columnGap, setColumnGap] = useState(meta.columnGap);
  const [header, setHeader] = useState(meta.header);
  const [footer, setFooter] = useState(meta.footer);
  const [watermarkText, setWatermarkText] = useState(meta.watermarkText);
  const [watermarkOpacity, setWatermarkOpacity] = useState(
    meta.watermarkOpacity,
  );
  const [watermarkAngle, setWatermarkAngle] = useState(meta.watermarkAngle);
  const [watermarkColor, setWatermarkColor] = useState(meta.watermarkColor);
  const [hasToc, setHasToc] = useState(meta.hasToc);
  const [tocDepth, setTocDepth] = useState(meta.tocDepth);
  const [tocTitle, setTocTitle] = useState(meta.tocTitle);

  // Sync fields when meta changes externally (e.g. file open)
  useEffect(() => {
    setTitle(meta.title);
  }, [meta.title]);
  useEffect(() => {
    setSummary(meta.summary);
  }, [meta.summary]);
  useEffect(() => {
    setAuthor(meta.author);
  }, [meta.author]);
  useEffect(() => {
    setPublication(meta.publication);
  }, [meta.publication]);
  useEffect(() => {
    setDate(meta.date);
  }, [meta.date]);
  useEffect(() => {
    setFontFamily(meta.fontFamily);
  }, [meta.fontFamily]);
  useEffect(() => {
    setFontSize(meta.fontSize);
  }, [meta.fontSize]);
  useEffect(() => {
    setFontLeading(meta.fontLeading);
  }, [meta.fontLeading]);
  useEffect(() => {
    setHeadingFont(meta.headingFont);
  }, [meta.headingFont]);
  useEffect(() => {
    setMonoFont(meta.monoFont);
  }, [meta.monoFont]);
  useEffect(() => {
    setPageSize(meta.pageSize);
  }, [meta.pageSize]);
  useEffect(() => {
    setPageOrientation(meta.pageOrientation);
  }, [meta.pageOrientation]);
  useEffect(() => {
    setMargins(meta.marginTop);
  }, [meta.marginTop]);
  useEffect(() => {
    setColumns(meta.columns);
  }, [meta.columns]);
  useEffect(() => {
    setColumnGap(meta.columnGap);
  }, [meta.columnGap]);
  useEffect(() => {
    setHeader(meta.header);
  }, [meta.header]);
  useEffect(() => {
    setFooter(meta.footer);
  }, [meta.footer]);
  useEffect(() => {
    setWatermarkText(meta.watermarkText);
  }, [meta.watermarkText]);
  useEffect(() => {
    setHasToc(meta.hasToc);
  }, [meta.hasToc]);
  useEffect(() => {
    setTocDepth(meta.tocDepth);
  }, [meta.tocDepth]);
  useEffect(() => {
    setTocTitle(meta.tocTitle);
  }, [meta.tocTitle]);

  const [openSection, setOpenSection] = useState<string | null>("identity");

  const toggleSection = (name: string) =>
    setOpenSection((cur) => (cur === name ? null : name));

  const chipInsert = (
    field: "header" | "footer",
    variable: string,
    setter: (v: string) => void,
    emitter: (v: string) => void,
  ) => {
    const current = field === "header" ? header : footer;
    const next = current ? `${current} ${variable}` : variable;
    setter(next);
    emitter(next);
  };

  return (
    <div className="side-panel document-panel">
      <div className="side-panel-header">
        <span className="side-panel-title">Document</span>
      </div>
      <div className="side-panel-body">
        {/* ── Identity ───────────────────────── */}
        <button
          className={`panel-section-toggle ${openSection === "identity" ? "open" : ""}`}
          onClick={() => toggleSection("identity")}
        >
          <span>Identity</span>
          <span className="panel-chevron">
            {openSection === "identity" ? "▾" : "▸"}
          </span>
        </button>
        {openSection === "identity" && (
          <div className="panel-section">
            <label className="panel-label">Document Title</label>
            <input
              className="panel-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                onTitleChange(e.target.value);
              }}
              placeholder="Untitled document"
            />

            <label className="panel-label">Summary</label>
            <textarea
              className="panel-textarea"
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                onSummaryChange(e.target.value);
              }}
              placeholder="Brief description"
              rows={2}
            />

            <div className="panel-row-3">
              <div>
                <label className="panel-label">Author</label>
                <input
                  className="panel-input"
                  value={author}
                  onChange={(e) => {
                    setAuthor(e.target.value);
                    onBylineChange(e.target.value, publication, date);
                  }}
                  placeholder="Name"
                />
              </div>
              <div>
                <label className="panel-label">Publication</label>
                <input
                  className="panel-input"
                  value={publication}
                  onChange={(e) => {
                    setPublication(e.target.value);
                    onBylineChange(author, e.target.value, date);
                  }}
                  placeholder="Publisher"
                />
              </div>
              <div>
                <label className="panel-label">Date</label>
                <input
                  className="panel-input"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    onBylineChange(author, publication, e.target.value);
                  }}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Typography ─────────────────────── */}
        <button
          className={`panel-section-toggle ${openSection === "typography" ? "open" : ""}`}
          onClick={() => toggleSection("typography")}
        >
          <span>Typography</span>
          <span className="panel-chevron">
            {openSection === "typography" ? "▾" : "▸"}
          </span>
        </button>
        {openSection === "typography" && (
          <div className="panel-section">
            <div className="panel-row-3">
              <div style={{ flex: 2 }}>
                <label className="panel-label">Body Font</label>
                <select
                  className="panel-select"
                  value={fontFamily}
                  onChange={(e) => {
                    setFontFamily(e.target.value);
                    onFontChange(
                      e.target.value,
                      fontSize,
                      fontLeading,
                      headingFont,
                      monoFont,
                    );
                  }}
                >
                  <option value="">Default</option>
                  <optgroup label="Serif">
                    {SERIF_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Sans-serif">
                    {SANS_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="panel-label">Size</label>
                <select
                  className="panel-select"
                  value={fontSize}
                  onChange={(e) => {
                    setFontSize(e.target.value);
                    onFontChange(
                      fontFamily,
                      e.target.value,
                      fontLeading,
                      headingFont,
                      monoFont,
                    );
                  }}
                >
                  <option value="">Default</option>
                  {SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="panel-label">Leading</label>
                <select
                  className="panel-select"
                  value={fontLeading}
                  onChange={(e) => {
                    setFontLeading(e.target.value);
                    onFontChange(
                      fontFamily,
                      fontSize,
                      e.target.value,
                      headingFont,
                      monoFont,
                    );
                  }}
                >
                  <option value="">Default</option>
                  {LEADINGS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="panel-label">Heading Font</label>
            <select
              className="panel-select"
              value={headingFont}
              onChange={(e) => {
                setHeadingFont(e.target.value);
                onFontChange(
                  fontFamily,
                  fontSize,
                  fontLeading,
                  e.target.value,
                  monoFont,
                );
              }}
            >
              <option value="">Same as body</option>
              {[...SERIF_FONTS, ...SANS_FONTS].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <label className="panel-label">Monospace Font</label>
            <select
              className="panel-select"
              value={monoFont}
              onChange={(e) => {
                setMonoFont(e.target.value);
                onFontChange(
                  fontFamily,
                  fontSize,
                  fontLeading,
                  headingFont,
                  e.target.value,
                );
              }}
            >
              <option value="">Default</option>
              {MONO_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Page Layout ────────────────────── */}
        <button
          className={`panel-section-toggle ${openSection === "page" ? "open" : ""}`}
          onClick={() => toggleSection("page")}
        >
          <span>Page Layout</span>
          <span className="panel-chevron">
            {openSection === "page" ? "▾" : "▸"}
          </span>
        </button>
        {openSection === "page" && (
          <div className="panel-section">
            <div className="panel-row-2">
              <div>
                <label className="panel-label">Size</label>
                <select
                  className="panel-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    onPageChange(
                      e.target.value,
                      pageOrientation,
                      margins,
                      columns,
                      columnGap,
                    );
                  }}
                >
                  <option value="">Default</option>
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="panel-label">Orientation</label>
                <div className="panel-radio-group">
                  <label className="panel-radio">
                    <input
                      type="radio"
                      name="orientation"
                      checked={pageOrientation === "portrait"}
                      onChange={() => {
                        setPageOrientation("portrait");
                        onPageChange(
                          pageSize,
                          "portrait",
                          margins,
                          columns,
                          columnGap,
                        );
                      }}
                    />
                    Portrait
                  </label>
                  <label className="panel-radio">
                    <input
                      type="radio"
                      name="orientation"
                      checked={pageOrientation === "landscape"}
                      onChange={() => {
                        setPageOrientation("landscape");
                        onPageChange(
                          pageSize,
                          "landscape",
                          margins,
                          columns,
                          columnGap,
                        );
                      }}
                    />
                    Landscape
                  </label>
                </div>
              </div>
            </div>

            <label className="panel-label">Margins</label>
            <input
              className="panel-input"
              value={margins}
              onChange={(e) => {
                setMargins(e.target.value);
                onPageChange(
                  pageSize,
                  pageOrientation,
                  e.target.value,
                  columns,
                  columnGap,
                );
              }}
              placeholder="e.g. 20mm"
            />

            <div className="panel-row-2">
              <div>
                <label className="panel-label">Columns</label>
                <select
                  className="panel-select"
                  value={columns}
                  onChange={(e) => {
                    setColumns(e.target.value);
                    onPageChange(
                      pageSize,
                      pageOrientation,
                      margins,
                      e.target.value,
                      columnGap,
                    );
                  }}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
              {columns !== "1" && (
                <div>
                  <label className="panel-label">Column Gap</label>
                  <input
                    className="panel-input"
                    value={columnGap}
                    onChange={(e) => {
                      setColumnGap(e.target.value);
                      onPageChange(
                        pageSize,
                        pageOrientation,
                        margins,
                        columns,
                        e.target.value,
                      );
                    }}
                    placeholder="e.g. 8mm"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Header & Footer ────────────────── */}
        <button
          className={`panel-section-toggle ${openSection === "headerfooter" ? "open" : ""}`}
          onClick={() => toggleSection("headerfooter")}
        >
          <span>Header &amp; Footer</span>
          <span className="panel-chevron">
            {openSection === "headerfooter" ? "▾" : "▸"}
          </span>
        </button>
        {openSection === "headerfooter" && (
          <div className="panel-section">
            <label className="panel-label">Header</label>
            <input
              className="panel-input"
              value={header}
              onChange={(e) => {
                setHeader(e.target.value);
                onHeaderChange(e.target.value);
              }}
              placeholder="Header text"
            />
            <div className="panel-chips">
              {["{{title}}", "{{date}}", "{{page}}"].map((v) => (
                <button
                  key={v}
                  className="panel-chip"
                  onClick={() =>
                    chipInsert("header", v, setHeader, onHeaderChange)
                  }
                >
                  {v}
                </button>
              ))}
            </div>

            <label className="panel-label" style={{ marginTop: 8 }}>
              Footer
            </label>
            <input
              className="panel-input"
              value={footer}
              onChange={(e) => {
                setFooter(e.target.value);
                onFooterChange(e.target.value);
              }}
              placeholder="Footer text"
            />
            <div className="panel-chips">
              {["{{page}}", "{{pages}}", "{{date}}", "{{title}}"].map((v) => (
                <button
                  key={v}
                  className="panel-chip"
                  onClick={() =>
                    chipInsert("footer", v, setFooter, onFooterChange)
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Watermark ──────────────────────── */}
        <button
          className={`panel-section-toggle ${openSection === "watermark" ? "open" : ""}`}
          onClick={() => toggleSection("watermark")}
        >
          <span>Watermark</span>
          <span className="panel-chevron">
            {openSection === "watermark" ? "▾" : "▸"}
          </span>
        </button>
        {openSection === "watermark" && (
          <div className="panel-section">
            <label className="panel-label">Text (leave empty to disable)</label>
            <input
              className="panel-input"
              value={watermarkText}
              onChange={(e) => {
                setWatermarkText(e.target.value);
                onWatermarkChange(
                  e.target.value,
                  watermarkOpacity,
                  watermarkAngle,
                  watermarkColor,
                );
              }}
              placeholder="e.g. DRAFT, CONFIDENTIAL"
            />

            <div className="panel-row-3">
              <div>
                <label className="panel-label">Opacity</label>
                <input
                  className="panel-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={watermarkOpacity}
                  onChange={(e) => {
                    setWatermarkOpacity(e.target.value);
                    onWatermarkChange(
                      watermarkText,
                      e.target.value,
                      watermarkAngle,
                      watermarkColor,
                    );
                  }}
                />
              </div>
              <div>
                <label className="panel-label">Angle</label>
                <input
                  className="panel-input"
                  value={watermarkAngle}
                  onChange={(e) => {
                    setWatermarkAngle(e.target.value);
                    onWatermarkChange(
                      watermarkText,
                      watermarkOpacity,
                      e.target.value,
                      watermarkColor,
                    );
                  }}
                  placeholder="-45"
                />
              </div>
              <div>
                <label className="panel-label">Color</label>
                <input
                  className="panel-input"
                  type="color"
                  value={watermarkColor}
                  onChange={(e) => {
                    setWatermarkColor(e.target.value);
                    onWatermarkChange(
                      watermarkText,
                      watermarkOpacity,
                      watermarkAngle,
                      e.target.value,
                    );
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Table of Contents ──────────────── */}
        <button
          className={`panel-section-toggle ${openSection === "toc" ? "open" : ""}`}
          onClick={() => toggleSection("toc")}
        >
          <span>Table of Contents</span>
          <span className="panel-chevron">
            {openSection === "toc" ? "▾" : "▸"}
          </span>
        </button>
        {openSection === "toc" && (
          <div className="panel-section">
            <label className="panel-radio" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={hasToc}
                onChange={(e) => {
                  setHasToc(e.target.checked);
                  onTocChange(e.target.checked, tocTitle, tocDepth);
                }}
              />
              Include TOC in document
            </label>

            {hasToc && (
              <div className="panel-row-2">
                <div>
                  <label className="panel-label">Title</label>
                  <input
                    className="panel-input"
                    value={tocTitle}
                    onChange={(e) => {
                      setTocTitle(e.target.value);
                      onTocChange(true, e.target.value, tocDepth);
                    }}
                    placeholder="Contents"
                  />
                </div>
                <div>
                  <label className="panel-label">Depth</label>
                  <select
                    className="panel-select"
                    value={tocDepth}
                    onChange={(e) => {
                      setTocDepth(e.target.value);
                      onTocChange(true, tocTitle, e.target.value);
                    }}
                  >
                    <option value="1">Sections only</option>
                    <option value="2">+ Subsections</option>
                    <option value="3">+ Sub-sub</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
