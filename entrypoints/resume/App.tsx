import { useEffect, useState } from "react";

import { ResumePicker } from "@/components/resume-picker";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import { DEFAULT_SETTINGS } from "@/lib/types";

import { ExtensionThemeProvider } from "../popup/components/extension-theme-provider";

export default function App() {
  const [snapshot, setSnapshot] = useState<PopupSnapshot | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    void sendMessage({ type: "GET_SNAPSHOT" }).then((res) => {
      if (!res.ok) {
        setBootError(res.error);
        return;
      }

      setSnapshot(res.snapshot ?? null);
    });
  }, []);

  const themeSettings = snapshot?.settings ?? DEFAULT_SETTINGS;

  if (bootError) {
    return (
      <ExtensionThemeProvider settings={themeSettings}>
        <div className="app">
          <p className="error">{bootError}</p>
        </div>
      </ExtensionThemeProvider>
    );
  }

  if (!snapshot) {
    return (
      <ExtensionThemeProvider settings={themeSettings}>
        <div className="app">
          <div className="empty">Loading…</div>
        </div>
      </ExtensionThemeProvider>
    );
  }

  return (
    <ExtensionThemeProvider settings={snapshot.settings}>
      <div className="app" style={{ maxWidth: 420, margin: "0 auto" }}>
        <ResumePicker snapshot={snapshot} onUpdate={setSnapshot} closeOnResume />
      </div>
    </ExtensionThemeProvider>
  );
}
