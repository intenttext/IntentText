# @dotit/pades

**PAdES (PDF Advanced Electronic Signatures) for IntentText** — export a sealed
`.it` document as a digitally-signed PDF that Adobe Reader, courts, banks, and
government portals recognize.

It's the **standards bridge** on top of IntentText's native trust: a `.it` stays
Ed25519-signed and *queryable* (`@dotit/sign`); the exported **PDF** carries an
X.509 / CMS **PAdES** signature the outside world auto-accepts. The two coexist.

- **Algorithm:** ECDSA P-256 + X.509 + CMS/PKCS#7 (`ETSI.CAdES.detached`).
  (Adobe doesn't validate Ed25519 PDF signatures — hence X.509 here.)
- **Levels:** PAdES-B (baseline) and **PAdES-T** (with an RFC-3161 trusted
  timestamp — proves *when*).
- **Trust:** self-signed for dev, or a real **X.509 chain** to a CA root (the
  UTS authority).
- **Runtime:** Node 18+ (uses built-in WebCrypto; no native crypto deps). ESM.

```bash
npm i @dotit/pades
```

## Quickstart — issue a signed PDF (server)

The easiest path is via `@dotit/pdf`, which renders the `.it` then signs the PDF:

```ts
import { renderSignedPDF } from "@dotit/pdf";
import { generateSelfSignedCert } from "@dotit/pades";

const id = await generateSelfSignedCert({
  commonName: "Dalil Technology",
  organization: "Dalil",
});

const signedPdf = await renderSignedPDF(sealedItSource, {
  executablePath: process.env.CHROME_PATH, // puppeteer-core needs a Chrome
  signer: {
    certPem: id.certPem,
    privateKeyPem: id.privateKeyPem,
    name: "Dalil Technology",
    reason: "Issued invoice",
    tsaUrl: "http://timestamp.digicert.com", // optional → PAdES-T
  },
});
// signedPdf: Uint8Array — opens in Adobe as a digitally-signed document.
```

## Sign an existing PDF buffer

```ts
import { signPdfWithPem, verifyPdfSignature } from "@dotit/pades";

const signed = await signPdfWithPem(pdfBytes, {
  certPem,
  privateKeyPem,
  name: "Sarah Al-Ahmad",
  tsaUrl: "http://timestamp.digicert.com", // optional
});

const info = await verifyPdfSignature(signed);
// { present, valid, coversWholeFile, signerCommonName, signedAt,
//   timestamped, timestampTime, chainValid }
```

## Signing identity (persist + reuse)

`generateSelfSignedCert` returns PEM strings — store them securely (e.g. the OS
keychain) and reload with `signerFromPem`:

```ts
const id = await generateSelfSignedCert({ commonName: "Acme Corp" });
// keep id.certPem + id.privateKeyPem  (private key → keychain / KMS)
const signer = await signerFromPem(id.certPem, id.privateKeyPem);
```

## Trusted identity — a CA chain (UTS-as-CA)

A self-signed cert is cryptographically valid but shows as "identity not trusted"
until installed. Issue signer certs from a CA whose root verifiers trust:

```ts
import { createCertificateAuthority, issueCertificate, signPdf, verifyPdfSignature } from "@dotit/pades";

const root = await createCertificateAuthority({ commonName: "UTS Root CA", organization: "UTS" });
// keep root.privateKeyPem OFFLINE

const signer = await issueCertificate({
  issuer: { certificate: root.certificate, privateKey: root.privateKey },
  commonName: "Dalil Technology",
});

const signed = await signPdf(pdfBytes, {
  certificate: signer.certificate,
  privateKey: signer.privateKey,
  chain: signer.chain,          // embeds the CA cert(s) in the signature
});

const info = await verifyPdfSignature(signed, { trustedRoots: [root.certificate] });
// info.chainValid === true
```

For production, keep the root key offline and issue an **intermediate**
(`issueCertificate({ ..., isCa: true })`) for online signing.

## API

| Function | Purpose |
|---|---|
| `generateSelfSignedCert(opts)` | ECDSA P-256 self-signed cert + key (PEM/DER) |
| `createCertificateAuthority(opts)` | a CA root/intermediate (cA:true) |
| `issueCertificate({ issuer, commonName, isCa? })` | CA-signed cert + chain |
| `signerFromPem(certPem, keyPem)` | load a signer from PEM |
| `signPdf(pdf, { certificate, privateKey, chain?, tsaUrl? })` | PAdES-sign a PDF |
| `signPdfWithPem(pdf, { certPem, privateKeyPem, tsaUrl? })` | sign via PEM identity |
| `verifyPdfSignature(pdf, { trustedRoots? })` | verify (signature, whole-file, timestamp, chain) |
| `requestTimestampToken(data, tsaUrl)` | low-level RFC-3161 timestamp |
| `signDetachedCms` / `verifyDetachedCms` | low-level CMS over arbitrary bytes |
| `PUBLIC_TSA` | `{ digicert, sectigo, swisssign }` free TSA URLs |

## Standards

PAdES-B-B / PAdES-B-T (ETSI EN 319 142), CMS (RFC 5652) with ESS
signing-certificate-v2 (RFC 5035), RFC-3161 timestamps, X.509 (RFC 5280),
ECDSA P-256 (FIPS 186-4). Built on `pkijs` + `@signpdf` + Node WebCrypto.

## License

MIT
