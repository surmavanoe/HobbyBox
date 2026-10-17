import { type ReactNode, useEffect, useState } from "react";
import { Platform } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

type Insets = { top: number; bottom: number; left: number; right: number };

const ZERO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

export const isEmbeddedWeb =
  Platform.OS === "web" && typeof window !== "undefined" && window.parent !== window;

function parseInsets(payload: unknown): Insets | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { top, bottom, left, right } = payload as Record<string, unknown>;
  if ([top, bottom, left, right].some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
  return { top: top as number, bottom: bottom as number, left: left as number, right: right as number };
}

/**
 * Inside the Lovable editor's device-frame preview, the web build receives
 * emulated safe-area insets from the parent frame (SET_SAFE_AREA) and applies
 * them so useSafeAreaInsets lays out around the frame's notch and home
 * indicator. On native, or outside an iframe, this is a pass-through.
 */
export function LovablePreviewSafeArea({ children }: { children: ReactNode }) {
  // Start from zeros in the embedded-web case so the tree shape never changes
  // when real insets arrive — swapping between bare children and the Provider
  // would remount the whole Expo Router subtree.
  const [insets, setInsets] = useState<Insets | null>(isEmbeddedWeb ? ZERO_INSETS : null);

  useEffect(() => {
    if (!isEmbeddedWeb) return;
    const onMessage = (event: MessageEvent) => {
      // Only the embedding Lovable editor may drive emulated insets.
      if (event.source !== window.parent) return;
      const data = event.data as { type?: string; payload?: unknown } | null;
      if (data?.type !== "SET_SAFE_AREA") return;
      const parsed = parseInsets(data.payload);
      // Keep the last valid insets on a malformed payload; the parent resets
      // explicitly by sending zeros.
      if (parsed) setInsets(parsed);
    };
    window.addEventListener("message", onMessage);
    // The parent may have pushed insets before this listener mounted; ask again.
    window.parent.postMessage({ type: "REQUEST_SAFE_AREA" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!insets) return children;
  return <SafeAreaInsetsContext value={insets}>{children}</SafeAreaInsetsContext>;
}