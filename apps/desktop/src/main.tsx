import React from "react";
import ReactDOM from "react-dom/client";
import { initRustCore, setRustCoreRuntimeMode } from "@intenttext/core";
import App from "./App";
import "./styles/global.css";
import "./styles/visual.css";

async function bootstrap() {
  try {
    const initialized = await initRustCore({
      wasmUrl: "/rust-wasm/intenttext_bg.wasm",
    });
    if (initialized) {
      setRustCoreRuntimeMode("rust-only");
    }
  } catch {
    // If wasm init fails we still render using the TS fallback parser.
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
