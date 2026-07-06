import { renderPDF, toPdfA } from './packages/pdf/dist/index.js';

const src = `title: Test Invoice
==

Hello **world**, this is a PDF/A test with Georgia and Times fonts.

- item one
- item two

sign: Test Co | Finance | 2026-07-06
`;

// use system chrome
process.env.PUPPETEER_EXECUTABLE_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// fake ICC (1KB) just to satisfy toPdfA
const icc = new Uint8Array(1024).fill(1);

const pdf = await renderPDF(src, {
  theme: "corporate",
  launchArgs: ["--no-sandbox"],
  pdfA: { iccProfile: icc, conformance: "3B", title: "Test Invoice", author: "Test Co" },
});
import { writeFileSync } from 'fs';
writeFileSync('scratch_out.pdf', pdf);
console.log("PDF bytes:", pdf.length);
