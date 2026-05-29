import { useMemo, useState, type ChangeEvent } from "react";
import {
  type TemplateValidationIssue,
  type TemplateValidationResult,
  renderHtml,
  validateTemplate,
} from "./lib/contracts";
import { applyArtifactMigrations } from "../shared/migration-hooks.js";

const DEFAULT_TEMPLATE = `title: Invoice\nsection: Bill To\ntext: {{client_name}}\ntext: {{client_address}}`;
const DEFAULT_DATA = `{
  "client_name": "Atlas Corp",
  "client_address": "Riyadh, KSA"
}`;

const ARTIFACT_SCHEMA_VERSION = "intenttext.template-artifact.v1";

type TemplateArtifact = {
  schema_version: string;
  export_mode: "template_only" | "template_with_sample_data";
  name: string;
  created_at: string;
  template_version: string;
  renderer_version: string;
  theme_version: string;
  template: string;
  data_json: string;
  checksum_sha256: string;
  integrity_signature: string;
};

type ImportArtifactResult = {
  migrationApplied: boolean;
  integrityMode: "verified" | "legacy_no_integrity";
  appliedHooks: string[];
  fromVersions: {
    template_version: string;
    renderer_version: string;
    theme_version: string;
  };
  toVersions: {
    template_version: string;
    renderer_version: string;
    theme_version: string;
  };
};

type LastImportReport = {
  source: "pasted_json" | "file";
  fileName?: string;
  integrityMode: "verified" | "legacy_no_integrity";
  appliedHooks: string[];
  fromVersions: {
    template_version: string;
    renderer_version: string;
    theme_version: string;
  };
  toVersions: {
    template_version: string;
    renderer_version: string;
    theme_version: string;
  };
};

type ArtifactIntegrityInput = Omit<
  TemplateArtifact,
  "checksum_sha256" | "integrity_signature"
>;

const ISSUE_HINTS: Record<string, string> = {
  LAYOUT_PAGE_SIZE_UNSUPPORTED:
    "Use A4, Letter, or Legal for predictable print output.",
  LAYOUT_MARGIN_NOT_NUMBER:
    "Set margin fields as numeric mm values, for example 12 or 12mm.",
  LAYOUT_MARGIN_RANGE:
    "Keep margins between 0 and 60mm unless there is a special print reason.",
  LAYOUT_SAFE_AREA_NOT_NUMBER: "Set safeArea as a numeric mm value.",
  LAYOUT_SAFE_AREA_RANGE: "Recommended safeArea range is 0 to 30mm.",
  LAYOUT_IMAGE_MISSING:
    "Provide image source in content or one of imageUrl/src/url/image properties.",
  LAYOUT_FIT_INVALID:
    "Use fit value contain, cover, or stretch for header/footer zones.",
  LAYOUT_ZONE_HEIGHT_NOT_NUMBER: "Set header/footer height as numeric mm.",
  LAYOUT_ZONE_HEIGHT_RANGE:
    "Keep header/footer heights within recommended zone ranges.",
  LAYOUT_BACKGROUND_IMAGE_MISSING:
    "Provide a background/watermark image source.",
  LAYOUT_BACKGROUND_FIT_INVALID:
    "Use fit value contain or cover for full-page background.",
  LAYOUT_OPACITY_NOT_NUMBER:
    "Set background opacity to a number between 0 and 1.",
  LAYOUT_OPACITY_RANGE: "Keep background opacity within 0..1.",
  LAYOUT_PAGE_BLOCK_RECOMMENDED:
    "Add page: block with size and margins for deterministic print layout.",
};

function App() {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [dataJson, setDataJson] = useState(DEFAULT_DATA);
  const [artifactName, setArtifactName] = useState("invoice-template");
  const [templateVersion, setTemplateVersion] = useState("template-v1");
  const [rendererVersion, setRendererVersion] = useState("renderer-v1");
  const [themeVersion, setThemeVersion] = useState("theme-v1");
  const [artifactBlob, setArtifactBlob] = useState("");
  const [artifactExportMode, setArtifactExportMode] = useState<
    "template_only" | "template_with_sample_data"
  >("template_with_sample_data");
  const [html, setHtml] = useState<string>("");
  const [output, setOutput] = useState<string>("Ready");
  const [validation, setValidation] = useState<TemplateValidationResult | null>(
    null,
  );
  const [lastImportReport, setLastImportReport] =
    useState<LastImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedData = useMemo(() => {
    try {
      return JSON.parse(dataJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [dataJson]);

  const groupedIssues = useMemo(() => {
    const grouped: Record<string, TemplateValidationIssue[]> = {
      parse: [],
      template: [],
      data_contract: [],
      system: [],
    };
    for (const issue of validation?.issues || []) {
      grouped[issue.category].push(issue);
    }
    return grouped;
  }, [validation]);

  async function onValidate() {
    setBusy(true);
    try {
      const result = await validateTemplate(template);
      setValidation(result);
      setOutput(
        result.valid
          ? `Template valid (${result.variables.all.length} variables found)`
          : `Template invalid (${result.issues.length} issues)`,
      );
    } catch (err) {
      setValidation(null);
      setOutput(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    if (!parsedData) {
      setOutput("Invalid JSON data payload");
      return;
    }
    setBusy(true);
    try {
      const result = await renderHtml({ template, data: parsedData });
      setHtml(result.html);
      setOutput("Preview rendered from shared render API");
    } catch (err) {
      setOutput(String(err));
    } finally {
      setBusy(false);
    }
  }

  function buildArtifactBase(): ArtifactIntegrityInput {
    return {
      schema_version: ARTIFACT_SCHEMA_VERSION,
      export_mode: artifactExportMode,
      name: artifactName.trim() || "unnamed-template",
      created_at: new Date().toISOString(),
      template_version: templateVersion.trim() || "template-v1",
      renderer_version: rendererVersion.trim() || "renderer-v1",
      theme_version: themeVersion.trim() || "theme-v1",
      template,
      data_json: artifactExportMode === "template_only" ? "{}" : dataJson,
    };
  }

  function toCanonicalArtifactString(input: ArtifactIntegrityInput): string {
    return JSON.stringify({
      schema_version: input.schema_version,
      export_mode: input.export_mode,
      name: input.name,
      created_at: input.created_at,
      template_version: input.template_version,
      renderer_version: input.renderer_version,
      theme_version: input.theme_version,
      template: input.template,
      data_json: input.data_json,
    });
  }

  async function sha256Hex(text: string): Promise<string> {
    const c = globalThis.crypto;
    if (!c?.subtle) {
      throw new Error("Web Crypto API is unavailable for artifact integrity.");
    }
    const encoded = new TextEncoder().encode(text);
    const digest = await c.subtle.digest("SHA-256", encoded);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function exportCurrentArtifact(successMessage: string) {
    const base = buildArtifactBase();
    const checksum = await sha256Hex(toCanonicalArtifactString(base));
    const artifact: TemplateArtifact = {
      ...base,
      checksum_sha256: checksum,
      integrity_signature: `sha256:${checksum}`,
    };

    const blob = JSON.stringify(artifact, null, 2);
    setArtifactBlob(blob);

    const fileBlob = new Blob([blob], { type: "application/json" });
    const url = URL.createObjectURL(fileBlob);
    const anchor = document.createElement("a");
    const safeName = artifact.name.replace(/[^a-zA-Z0-9-_]+/g, "-");
    anchor.href = url;
    anchor.download = `${safeName || "template"}.intenttemplate.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setOutput(successMessage);
  }

  async function onExportArtifact() {
    setBusy(true);
    try {
      await exportCurrentArtifact(
        "Template artifact exported with integrity signature.",
      );
    } catch (err) {
      setOutput(`Artifact export failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onReExportUpgradedArtifact() {
    setBusy(true);
    try {
      await exportCurrentArtifact(
        "Upgraded artifact re-exported with integrity signature.",
      );
    } catch (err) {
      setOutput(`Artifact re-export failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function importArtifactText(
    text: string,
  ): Promise<ImportArtifactResult> {
    const parsed = JSON.parse(text) as Partial<TemplateArtifact> & {
      templateVersion?: string;
      rendererVersion?: string;
      themeVersion?: string;
    };
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Artifact JSON is invalid.");
    }
    if (parsed.schema_version !== ARTIFACT_SCHEMA_VERSION) {
      throw new Error("Artifact schema_version is unsupported.");
    }
    if (
      parsed.export_mode !== "template_only" &&
      parsed.export_mode !== "template_with_sample_data"
    ) {
      throw new Error("Artifact export_mode is invalid.");
    }
    if (
      typeof parsed.template !== "string" ||
      typeof parsed.data_json !== "string"
    ) {
      throw new Error("Artifact must include template and data_json strings.");
    }
    if (
      typeof parsed.name !== "string" ||
      typeof parsed.created_at !== "string" ||
      typeof parsed.template !== "string" ||
      typeof parsed.data_json !== "string"
    ) {
      throw new Error("Artifact is missing required metadata fields.");
    }

    const migrated = await applyArtifactMigrations(parsed);
    const normalized = migrated.artifact;

    if (
      typeof normalized.template_version !== "string" ||
      typeof normalized.renderer_version !== "string" ||
      typeof normalized.theme_version !== "string"
    ) {
      throw new Error(
        "Artifact migration failed to produce required version metadata.",
      );
    }
    if (
      typeof normalized.template !== "string" ||
      typeof normalized.data_json !== "string"
    ) {
      throw new Error(
        "Artifact migration failed to preserve template/data payload.",
      );
    }

    const base: ArtifactIntegrityInput = {
      schema_version: parsed.schema_version,
      export_mode: parsed.export_mode,
      name: parsed.name,
      created_at: parsed.created_at,
      template_version: normalized.template_version,
      renderer_version: normalized.renderer_version,
      theme_version: normalized.theme_version,
      template: normalized.template,
      data_json: normalized.data_json,
    };

    let integrityMode: ImportArtifactResult["integrityMode"] =
      "legacy_no_integrity";
    const hasChecksum = typeof parsed.checksum_sha256 === "string";
    const hasSignature = typeof parsed.integrity_signature === "string";

    if (hasChecksum !== hasSignature) {
      throw new Error(
        "Artifact integrity fields must include both checksum and signature.",
      );
    }

    if (hasChecksum && hasSignature) {
      const expectedChecksum = await sha256Hex(toCanonicalArtifactString(base));
      if (parsed.checksum_sha256 !== expectedChecksum) {
        throw new Error("Artifact checksum verification failed.");
      }
      if (parsed.integrity_signature !== `sha256:${expectedChecksum}`) {
        throw new Error("Artifact signature verification failed.");
      }
      integrityMode = "verified";
    }

    setTemplate(normalized.template);
    setDataJson(normalized.data_json);
    setArtifactExportMode(parsed.export_mode);
    setArtifactName(parsed.name);
    setTemplateVersion(normalized.template_version);
    setRendererVersion(normalized.renderer_version);
    setThemeVersion(normalized.theme_version);

    return {
      migrationApplied: migrated.migration.applied_hooks.length > 0,
      integrityMode,
      appliedHooks: migrated.migration.applied_hooks,
      fromVersions: migrated.migration.from,
      toVersions: migrated.migration.to,
    };
  }

  async function onImportArtifact() {
    setBusy(true);
    try {
      const result = await importArtifactText(artifactBlob);
      setLastImportReport({
        source: "pasted_json",
        integrityMode: result.integrityMode,
        appliedHooks: result.appliedHooks,
        fromVersions: result.fromVersions,
        toVersions: result.toVersions,
      });
      if (result.integrityMode === "verified") {
        setOutput(
          result.migrationApplied
            ? "Template artifact imported, migrated, and integrity-verified."
            : "Template artifact imported and integrity-verified.",
        );
      } else {
        setOutput(
          result.migrationApplied
            ? "Legacy artifact imported, migrated, and loaded (no integrity fields)."
            : "Legacy artifact loaded (no integrity fields).",
        );
      }
    } catch (err) {
      setOutput(`Artifact import failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onImportArtifactFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const text = await file.text();
      setArtifactBlob(text);
      const result = await importArtifactText(text);
      setLastImportReport({
        source: "file",
        fileName: file.name,
        integrityMode: result.integrityMode,
        appliedHooks: result.appliedHooks,
        fromVersions: result.fromVersions,
        toVersions: result.toVersions,
      });
      if (result.integrityMode === "verified") {
        setOutput(
          result.migrationApplied
            ? `Template artifact file imported, migrated, and integrity-verified: ${file.name}`
            : `Template artifact file imported: ${file.name}`,
        );
      } else {
        setOutput(
          result.migrationApplied
            ? `Legacy artifact file imported and migrated: ${file.name}`
            : `Legacy artifact file imported: ${file.name}`,
        );
      }
    } catch (err) {
      setOutput(`Artifact file import failed: ${String(err)}`);
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  }

  return (
    <div className="layout">
      <header>
        <h1>IntentText Builder</h1>
        <p>V1 shell: template editor + validate + shared-render preview.</p>
      </header>

      <section className="grid">
        <article>
          <h2>Template</h2>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
        </article>

        <article>
          <h2>Data JSON</h2>
          <textarea
            value={dataJson}
            onChange={(e) => setDataJson(e.target.value)}
          />
        </article>
      </section>

      <section className="actions">
        <button onClick={onValidate} disabled={busy}>
          Validate Template
        </button>
        <button onClick={onPreview} disabled={busy}>
          Render Preview
        </button>
      </section>

      <section className="grid">
        <article>
          <h2>Template Artifact</h2>
          <p className="muted">
            Export/import opaque artifact JSON with template, data, and version
            metadata.
          </p>
          <div className="inline-fields">
            <label>
              Export Mode
              <select
                value={artifactExportMode}
                onChange={(e) =>
                  setArtifactExportMode(
                    e.target.value as
                      | "template_only"
                      | "template_with_sample_data",
                  )
                }
              >
                <option value="template_with_sample_data">
                  Template + Sample Data
                </option>
                <option value="template_only">Template Only</option>
              </select>
            </label>
            <label>
              Name
              <input
                value={artifactName}
                onChange={(e) => setArtifactName(e.target.value)}
              />
            </label>
            <label>
              Template Version
              <input
                value={templateVersion}
                onChange={(e) => setTemplateVersion(e.target.value)}
              />
            </label>
            <label>
              Renderer Version
              <input
                value={rendererVersion}
                onChange={(e) => setRendererVersion(e.target.value)}
              />
            </label>
            <label>
              Theme Version
              <input
                value={themeVersion}
                onChange={(e) => setThemeVersion(e.target.value)}
              />
            </label>
          </div>
          <div className="actions artifact-actions">
            <button onClick={onExportArtifact} disabled={busy}>
              Export Artifact
            </button>
            <button
              onClick={onImportArtifact}
              disabled={busy || artifactBlob.trim().length === 0}
            >
              Import Artifact
            </button>
          </div>
          <label className="file-input-label">
            Import From File
            <input
              type="file"
              accept=".json,.intenttemplate.json,application/json"
              onChange={onImportArtifactFile}
              disabled={busy}
            />
          </label>
          <textarea
            value={artifactBlob}
            onChange={(e) => setArtifactBlob(e.target.value)}
            placeholder="Artifact JSON appears here on export, or paste one to import"
          />
        </article>
      </section>

      <section className="grid">
        <article>
          <h2>Output</h2>
          <pre>{output}</pre>

          <h2>Last Import Migration</h2>
          {!lastImportReport ? (
            <span className="empty">No import report yet</span>
          ) : (
            <div className="migration-report">
              <div className="migration-line">
                <strong>Source:</strong>{" "}
                {lastImportReport.source === "file"
                  ? `file (${lastImportReport.fileName || "unknown"})`
                  : "pasted json"}
              </div>
              <div className="migration-line">
                <strong>Integrity:</strong>{" "}
                {lastImportReport.integrityMode === "verified"
                  ? "verified"
                  : "legacy_no_integrity"}
              </div>
              <div className="migration-line">
                <strong>Version Transition:</strong>{" "}
                {`${lastImportReport.fromVersions.template_version}/${lastImportReport.fromVersions.renderer_version}/${lastImportReport.fromVersions.theme_version} -> ${lastImportReport.toVersions.template_version}/${lastImportReport.toVersions.renderer_version}/${lastImportReport.toVersions.theme_version}`}
              </div>
              <div className="migration-line">
                <strong>Applied Hooks:</strong>{" "}
                {lastImportReport.appliedHooks.length > 0
                  ? lastImportReport.appliedHooks.join(", ")
                  : "none"}
              </div>
              {lastImportReport.integrityMode === "legacy_no_integrity" ||
              lastImportReport.appliedHooks.length > 0 ? (
                <div className="migration-actions">
                  <button onClick={onReExportUpgradedArtifact} disabled={busy}>
                    Re-export Upgraded Artifact
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <h2>Variables</h2>
          <div className="pill-wrap">
            {!validation || validation.variables.all.length === 0 ? (
              <span className="empty">No variables detected yet</span>
            ) : (
              validation.variables.all.map((v) => (
                <span key={v} className="pill var">
                  {v}
                </span>
              ))
            )}
          </div>

          <h2>Repeated Variables</h2>
          <div className="issue-list">
            {!validation ? (
              <span className="empty">
                Run validate to inspect repeated variables
              </span>
            ) : validation.variables.repeated.length === 0 ? (
              <span className="empty">No repeated variables detected</span>
            ) : (
              validation.variables.repeated.map((item, idx) => (
                <div key={`${item.path}-${idx}`} className="issue-item">
                  <span className="pill var">REPEATED</span>
                  <span className="issue-code">{item.path}</span>
                  {item.collection ? (
                    <span className="issue-path">from {item.collection}</span>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <h2>Validation Issues</h2>
          {!validation ? (
            <span className="empty">Run validate to see issues</span>
          ) : validation.issues.length === 0 ? (
            <span className="empty">No issues</span>
          ) : (
            <>
              {(["template", "parse", "data_contract", "system"] as const).map(
                (category) =>
                  groupedIssues[category].length > 0 ? (
                    <div key={category} className="issue-group">
                      <h3>{category.replace("_", " ")}</h3>
                      <div className="issue-list">
                        {groupedIssues[category].map((issue, idx) => (
                          <div
                            key={`${category}-${issue.code}-${idx}`}
                            className="issue-item"
                          >
                            <span
                              className={`pill ${
                                issue.severity === "error" ? "error" : "warning"
                              }`}
                            >
                              {issue.severity.toUpperCase()}
                            </span>
                            <span className="issue-code">{issue.code}</span>
                            <span>{issue.message}</span>
                            {issue.path ? (
                              <span className="issue-path">({issue.path})</span>
                            ) : null}
                            {ISSUE_HINTS[issue.code] ? (
                              <div className="issue-hint">
                                Hint: {ISSUE_HINTS[issue.code]}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null,
              )}
            </>
          )}
        </article>
        <article>
          <h2>HTML Preview</h2>
          <iframe title="preview" srcDoc={html} />
        </article>
      </section>
    </div>
  );
}

export default App;
