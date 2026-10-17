import { useEffect } from "react";
import { Platform } from "react-native";

const isEmbeddedWeb =
  Platform.OS === "web" && typeof window !== "undefined" && window.parent !== window;

// No !important: react-native-web's atomic classes (Text selectable /
// style.userSelect, pressable cursors) must still win over these defaults.
const NATIVE_SELECTION_CSS = `
html, body {
  -webkit-user-select: none;
  user-select: none;
  cursor: default;
}
input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"] {
  -webkit-user-select: text;
  user-select: text;
  cursor: text;
}
* {
  scrollbar-width: none;
}
*::-webkit-scrollbar {
  display: none;
}
`;

export function LovablePreviewTextSelection() {
  useEffect(() => {
    if (!__DEV__ || !isEmbeddedWeb) return;
    const style = document.createElement("style");
    style.textContent = NATIVE_SELECTION_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return null;
}
