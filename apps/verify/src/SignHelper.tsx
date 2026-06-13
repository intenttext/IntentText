import { useState } from "react";
import { generateSigningKey, signDocumentCrypto } from "@dotit/sign";
import { truncateMiddle } from "./verify";

/**
 * A small in-browser "try the whole loop" helper: generate an Ed25519 keypair
 * and sign a pasted .it document — all client-side, no network. Clearly labeled
 * as a testing aid; real keys live in the desktop app / a proper key store.
 */
export function SignHelper() {
  const [key, setKey] = useState<{
    privateKey: string;
    publicKey: string;
  } | null>(null);
  const [signer, setSigner] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState("");
  const [signed, setSigned] = useState("");
  const [error, setError] = useState("");

  function onGenerate() {
    setKey(generateSigningKey());
    setSigned("");
    setError("");
  }

  function onSign() {
    setError("");
    if (!key) {
      setError("Generate a keypair first.");
      return;
    }
    if (!signer.trim()) {
      setError("Enter a signer name.");
      return;
    }
    if (!source.trim()) {
      setError("Paste a .it document to sign.");
      return;
    }
    try {
      const res = signDocumentCrypto(source, {
        signer: signer.trim(),
        role: role.trim() || undefined,
        privateKey: key.privateKey,
      });
      setSigned(res.source);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <p className="helper-note">
        For testing only. This generates a throwaway key in your browser so you
        can try the sign → verify loop. In production, signing keys live in the
        desktop app or your organization's key store — never paste a real
        private key into a web page.
      </p>

      <div className="toolbar-row" style={{ marginTop: 0 }}>
        <button type="button" className="btn" onClick={onGenerate}>
          Generate test keypair
        </button>
      </div>

      {key && (
        <div style={{ marginTop: 14 }}>
          <div className="keybox">
            <span className="klabel">Public key (safe to share)</span>
            ed25519:{key.publicKey}
          </div>
          <div className="keybox">
            <span className="klabel">
              Private key — testing only, keep secret
            </span>
            {truncateMiddle(key.privateKey, 10, 8)} (hidden)
          </div>

          <div className="field">
            <label htmlFor="sh-signer">Signer name</label>
            <input
              id="sh-signer"
              value={signer}
              onChange={(e) => setSigner(e.target.value)}
              placeholder="e.g. Ahmed Al-Rashid"
            />
          </div>
          <div className="field">
            <label htmlFor="sh-role">Role (optional)</label>
            <input
              id="sh-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. CEO"
            />
          </div>
          <div className="field">
            <label htmlFor="sh-src">Document to sign (.it)</label>
            <textarea
              id="sh-src"
              className="paste"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="title: Test Agreement&#10;note: This is a test."
            />
          </div>

          <div className="toolbar-row" style={{ marginTop: 0 }}>
            <button type="button" className="btn primary" onClick={onSign}>
              Sign document
            </button>
          </div>

          {error && (
            <p style={{ color: "var(--red)", fontSize: "0.84rem" }}>{error}</p>
          )}

          {signed && (
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="sh-out">
                Signed .it — copy this into the Verify tab to see it pass
              </label>
              <textarea
                id="sh-out"
                className="paste"
                readOnly
                value={signed}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
