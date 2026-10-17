import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type HermesRejectionTracker = {
  hasPromise?: () => boolean;
  enablePromiseRejectionTracker?: (options: {
    allRejections?: boolean;
    onUnhandled?: (id: number, rejection?: unknown) => void;
    onHandled?: (id: number) => void;
  }) => void;
};

type GlobalWithHooks = {
  HermesInternal?: HermesRejectionTracker;
  ErrorUtils?: { getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void };
};

// Capability rejections from simulator builds, e.g. expo-camera's "Camera not
// available on simulator"; proximity-bound so unrelated messages never match.
const SIMULATOR_UNAVAILABLE =
  /\b(?:not available|unavailable|not supported)\s+(?:on|in)\s+(?:the\s+)?(?:ios\s+|android\s+)?simulator\b/i;

function simulatorUnavailableError(rejection: unknown): Error | null {
  return rejection instanceof Error && SIMULATOR_UNAVAILABLE.test(rejection.message)
    ? rejection
    : null;
}

// Mirrors @expo/metro-runtime's dev-mode tracker so non-simulator rejections
// keep the exact developer error surface they have today.
function reportUnhandledRejection(id: number, rejection: unknown) {
  let message: string;
  if (rejection === undefined) {
    message = "";
  } else if (Object.prototype.toString.call(rejection) === "[object Error]") {
    message = Error.prototype.toString.call(rejection);
  } else {
    try {
      message = (require("pretty-format") as { format: (value: unknown) => string }).format(
        rejection,
      );
    } catch {
      message = typeof rejection === "string" ? rejection : JSON.stringify(rejection);
    }
  }
  const prefix = `Uncaught (in promise, id: ${id})`;
  const error = new Error(`${prefix} ${message ?? ""}`, { cause: rejection });
  const rejectionStack =
    rejection && typeof rejection === "object" && "stack" in rejection
      ? (rejection as { stack?: unknown }).stack
      : undefined;
  error.stack =
    typeof rejectionStack === "string"
      ? `${prefix} ${rejectionStack}`
      : `${prefix} ${message ?? ""}`;
  const globalHandler = (globalThis as GlobalWithHooks).ErrorUtils?.getGlobalHandler?.();
  if (globalHandler) {
    globalHandler(error, false);
  } else {
    console.error(error);
  }
}

// Dev-only: capability rejections in a simulator (no camera or similar hardware)
// show a dismissible notice instead of the fatal developer error overlay.
export function LovableSimulatorGuard({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    const hermes = (globalThis as GlobalWithHooks).HermesInternal;
    if (!hermes?.hasPromise?.() || !hermes.enablePromiseRejectionTracker) {
      return;
    }
    let disposed = false;
    const interceptedIds = new Set<number>();
    hermes.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (id, rejection) => {
        const error = simulatorUnavailableError(rejection);
        if (error && !disposed) {
          // Keep the event visible in Metro logs; only the red overlay is replaced.
          console.warn(`Simulator capability unavailable: ${error.message}`);
          interceptedIds.add(id);
          setNotice(error.message);
          return;
        }
        reportUnhandledRejection(id, rejection);
      },
      onHandled: (id) => {
        if (interceptedIds.delete(id)) {
          return;
        }
        console.warn(
          `Promise rejection handled (id: ${id})\n` +
            "This means you can ignore any previous messages of the form " +
            `"Uncaught (in promise, id: ${id})"`,
        );
      },
    });
    return () => {
      disposed = true;
    };
  }, []);

  // Children stay in place and the scrim mounts as a sibling, so showing or
  // dismissing the notice never reparents (and so remounts) the app subtree.
  return (
    <>
      {children}
      {notice != null && (
        <View style={styles.scrim}>
          <View style={styles.card}>
            <Text style={styles.title}>Not available in the simulator</Text>
            <Text style={styles.body}>
              This preview device can't run that feature: the simulator has no camera or similar
              hardware. Try a fallback like the photo library, or test on a physical device.
            </Text>
            <Text style={styles.detail}>{notice}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setNotice(null)}
              // NativeWind's native runtime drops a function `style` (nativewind#1105).
              cssInterop={false}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonLabel}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}

// Plain styles on purpose: this surface must render even when the app's
// styling pipeline is part of what broke.
const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 15, 15, 0.55)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: "#444444",
    marginBottom: 12,
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    color: "#888888",
    marginBottom: 16,
  },
  button: {
    alignSelf: "flex-end",
    borderRadius: 10,
    backgroundColor: "#111111",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
});
