// Shared browser print: write an HTML document into a real-size hidden iframe
// and open the native print dialog (→ Save as PDF). A zero-size iframe prints
// blank/unstyled in Chrome, so the frame gets A4 dimensions off-screen.

export function printHtmlViaIframe(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
    } finally {
      setTimeout(() => iframe.remove(), 1000);
    }
  };
  iframe.onload = () => window.setTimeout(doPrint, 120);

  const idoc = iframe.contentWindow!.document;
  idoc.open();
  idoc.write(html);
  idoc.close();
  // Fallback if onload doesn't fire for a written document.
  if (idoc.readyState === "complete") window.setTimeout(doPrint, 250);
}
