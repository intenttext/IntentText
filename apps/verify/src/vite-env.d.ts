/// <reference types="vite/client" />

// DOCUMENT_CSS is not re-exported from @dotit/core's index, but it ships as a
// runtime value at this dist subpath. Declare the shape so TS is happy.
declare module "@dotit/core/dist/document-css" {
  export const DOCUMENT_CSS: string;
}
