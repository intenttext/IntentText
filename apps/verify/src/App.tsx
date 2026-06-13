import { useCallback, useRef, useState } from "react";
import { runVerification, type VerifyReport } from "./verify";
import { VerdictBanner, ResultCard } from "./ResultCard";
import { Preview } from "./Preview";
import { SignHelper } from "./SignHelper";

type Tab = "verify" | "sign";

function Header({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <header className="site-header">
      <img src="/logo.png" alt="IntentText .it logo" width={44} height={44} />
      <div className="titles">
        <h1>verify.uts.qa</h1>
        <p>Verify an IntentText (.it) document — entirely in your browser.</p>
      </div>
      <div className="spacer" />
      <div className="tabs" role="tablist" aria-label="Mode">
        <button
          role="tab"
          aria-selected={tab === "verify"}
          onClick={() => setTab("verify")}
        >
          Verify
        </button>
        <button
          role="tab"
          aria-selected={tab === "sign"}
          onClick={() => setTab("sign")}
        >
          Sign a document
        </button>
      </div>
    </header>
  );
}

function PrivacyPromise() {
  return (
    <div className="privacy-promise">
      <span className="lock" aria-hidden>
        🔒
      </span>
      <span>
        <strong>Your file never leaves your browser.</strong> Verification
        happens entirely on this page — no upload, no server, no network call.
      </span>
    </div>
  );
}

function Disclosure({ report }: { report: VerifyReport }) {
  const cert = report.certifications.find((c) => c.valid);
  return (
    <div className="disclosure">
      <h3>What this verification proves — and what it doesn't</h3>
      <ul>
        <li>
          <span className="proves">Proves:</span> the document's content has not
          changed since it was sealed or signed (a single edited character
          breaks the hash).
        </li>
        <li>
          <span className="proves">Proves:</span> each valid signature was made
          by the holder of the embedded Ed25519 public key.
        </li>
        {cert ? (
          <li>
            <span className="proves">Proves:</span> <strong>UTS certified</strong>{" "}
            this exact content
            {cert.account ? (
              <>
                {" "}
                under account <strong>{cert.account}</strong>
              </>
            ) : null}
            {cert.at ? (
              <>
                {" "}
                at <strong>{cert.at.slice(0, 19).replace("T", " ")} UTC</strong>
              </>
            ) : null}{" "}
            — a provable timestamp bound to an account, signed by UTS's published
            key.
          </li>
        ) : null}
        <li>
          <span className="notproves">Does not prove:</span> that an account or
          key belongs to a specific verified real-world identity — binding a key
          to a vetted identity (KYC) is{" "}
          <strong>UTS identity attestation</strong> (Phase 3b), coming next.
        </li>
      </ul>
    </div>
  );
}

function VerifyTab() {
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const verify = useCallback((source: string, name: string) => {
    setFilename(name);
    setReport(runVerification(source));
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => verify(String(reader.result ?? ""), file.name);
      reader.readAsText(file);
    },
    [verify],
  );

  return (
    <>
      <PrivacyPromise />

      {!showPaste ? (
        <div
          className={`dropzone${dragging ? " dragging" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Drop a .it file, or click to choose one"
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <div className="big">Drop a .it file here</div>
          <div className="sub">or click to choose a file from your device</div>
          <div className="or">
            …or{" "}
            <button
              type="button"
              className="linkbtn"
              onClick={(e) => {
                e.stopPropagation();
                setShowPaste(true);
              }}
            >
              paste its contents
            </button>{" "}
            instead
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".it,.txt,text/plain"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      ) : (
        <div>
          <label
            htmlFor="paste-area"
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Paste .it document contents
          </label>
          <textarea
            id="paste-area"
            className="paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="title: …"
          />
          <div className="toolbar-row">
            <button
              type="button"
              className="btn primary"
              disabled={!pasteText.trim()}
              onClick={() => verify(pasteText, "pasted document")}
            >
              Verify
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShowPaste(false)}
            >
              Use file drop instead
            </button>
          </div>
        </div>
      )}

      {report && (
        <div style={{ marginTop: 8 }}>
          {filename && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                margin: "16px 0 0",
              }}
            >
              Verifying: <strong>{filename}</strong>
            </p>
          )}
          <VerdictBanner report={report} />
          {report.parseError && (
            <div className="helper-note" role="alert">
              Could not fully parse this document: {report.parseError}
            </div>
          )}
          <ResultCard report={report} />
          {report.previewHTML && <Preview html={report.previewHTML} />}
          <Disclosure report={report} />
        </div>
      )}
    </>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>("verify");
  return (
    <div className="shell">
      <Header tab={tab} setTab={setTab} />
      {tab === "verify" ? <VerifyTab /> : <SignHelper />}
      <footer className="site-footer">
        IntentText is self-verifying, offline, and zero-dependency. Learn more at{" "}
        <a href="https://dotit.uts.qa" target="_blank" rel="noreferrer">
          dotit.uts.qa
        </a>
        .
      </footer>
    </div>
  );
}
