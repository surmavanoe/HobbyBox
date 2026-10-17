import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { isEmbeddedWeb } from "./lovable-preview-safe-area";

type RuntimeErrorPayload = {
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  blankScreen: boolean;
};

type EditorReportHook = (payload: { message: string; stack?: string; filename?: string }) => void;
type WindowWithEditorHook = Window & { __lovableReportRuntimeError?: EditorReportHook };

// Same editor origins lovable.js trusts (script_tag/src/utils.ts); a parent is
// not trusted merely for being the parent.
const EDITOR_ORIGINS = ["https://lovable.dev", "https://beta.lovable.dev", "https://gptengineer.app"];
const EDITOR_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.beta\.lovable\.dev$/,
  /^https:\/\/[a-z0-9-]+\.dwl\.lovable\.dev$/,
  /^https:\/\/[a-z0-9-]+\.sandcastle\.lovable\.net$/,
  /^http:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/,
];

const INVISIBLE_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT"]);
const MAX_MESSAGE_CHARS = 2000;
const MAX_STACK_CHARS = 8000;
const REPORT_DEDUPE_WINDOW_MS = 5000;
const MAX_REPORTED_IDS = 100;
const reportedAt = new Map<string, number>();

// Installed by the editor-injected lovable.js, which forwards window errors and
// rejections itself; when present only boundary-caught errors need this file.
function editorReportHook(): EditorReportHook | null {
  const hook = (window as WindowWithEditorHook).__lovableReportRuntimeError;
  return typeof hook === "function" ? hook : null;
}

function markReported(id: string): boolean {
  const now = Date.now();
  for (const [key, at] of reportedAt) {
    if (now - at <= REPORT_DEDUPE_WINDOW_MS) break;
    reportedAt.delete(key);
  }
  if (reportedAt.has(id)) return false;
  if (reportedAt.size >= MAX_REPORTED_IDS) reportedAt.delete(reportedAt.keys().next().value as string);
  reportedAt.set(id, now);
  return true;
}

// Compact mirror of lovable.js's stripSecretsFromText: error text can echo
// request context, and the editor only redacts dev-server hosts downstream.
function stripSecrets(text: string): string {
  return text
    .replace(
      /([?&](?:__lovable_token|access_token|refresh_token|id_token|token|api[-_]?key|apikey|key|secret|client_secret|password|signature|sig|session)=)[^&\s"']+/gi,
      "$1[redacted]",
    )
    .replace(/\b(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[redacted]")
    .replace(/\b((?:set-)?cookie"?\s*[:=]\s*).*/gi, "$1[redacted]")
    .replace(/\b([\w-]*(?:token|secret|password|passwd|session)[\w-]*"?\s*[:=]\s*)["']?[^\s"',}&]+/gi, "$1[redacted]")
    .replace(
      /("?(?:authorization|api[-_]?key|x-api-key|apikey|private[-_]?key|signature)"?\s*[:=]\s*)["']?[^\s"',}&]+/gi,
      "$1[redacted]",
    )
    .replace(/\beyJ[A-Za-z0-9._-]{10,}/g, "[redacted-jwt]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[redacted]");
}

// Scrub an 8x window before the final cut so a secret straddling the budget
// cannot leave a usable partial, without running the regexes over megabytes.
function capped(text: string, max: number): string {
  return stripSecrets(text.slice(0, max * 8)).slice(0, max);
}

function describe(value: unknown): { message: string; stack?: string } {
  if (value instanceof Response) {
    return { message: `Response ${value.status}${value.url ? ` at ${value.url}` : ""}` };
  }
  if (value instanceof Error) {
    return { message: value.message || value.name, stack: value.stack };
  }
  if (typeof value === "string") return { message: value };
  try {
    return { message: JSON.stringify(value) ?? String(value) };
  } catch {
    return { message: String(value) };
  }
}

function isScreenBlank(): boolean {
  const root = document.getElementById("root");
  if (root) return root.children.length === 0;
  return Array.from(document.body?.children ?? []).every((el) => INVISIBLE_TAGS.has(el.tagName));
}

function parentOrigin(): string | null {
  const candidate = window.location.ancestorOrigins?.[0] ?? document.referrer;
  if (!candidate || candidate === "null") return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

function editorTargets(): string[] {
  const parent = parentOrigin();
  if (parent === null) return EDITOR_ORIGINS;
  const trusted = EDITOR_ORIGINS.includes(parent) || EDITOR_ORIGIN_PATTERNS.some((pattern) => pattern.test(parent));
  return trusted ? [parent] : [];
}

function post(type: "RUNTIME_ERROR" | "UNHANDLED_PROMISE_REJECTION", payload: RuntimeErrorPayload) {
  const message = capped(payload.message, MAX_MESSAGE_CHARS);
  if (!message) return;
  const stack = payload.stack ? capped(payload.stack, MAX_STACK_CHARS) : undefined;
  const filename = payload.filename ? stripSecrets(payload.filename) : undefined;
  if (!markReported(`${type}|${message}|${stack ?? ""}`)) return;
  const envelope = { type, payload: { ...payload, message, stack, filename } };
  for (const target of editorTargets()) {
    try {
      window.parent.postMessage(envelope, target);
    } catch {
      // Only a malformed target throws; a mismatched one is dropped silently.
    }
  }
}

function installGlobalHandlers(): () => void {
  const onError = (event: ErrorEvent) => {
    if (editorReportHook()) return;
    const { message, stack } = describe(event.error ?? event.message);
    post("RUNTIME_ERROR", {
      message,
      stack,
      filename: event.filename || undefined,
      lineno: event.lineno || undefined,
      colno: event.colno || undefined,
      blankScreen: isScreenBlank(),
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (editorReportHook()) return;
    const reason: unknown = event.reason;
    const hasStack = typeof (reason as { stack?: unknown } | null)?.stack === "string";
    if (!hasStack && !(reason instanceof Response)) return;
    const { message, stack } = describe(reason);
    post("UNHANDLED_PROMISE_REJECTION", { message, stack, blankScreen: isScreenBlank() });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

type BoundaryState = { failure: { message: string } | null };

// In dev Expo wraps the app in a LogBox error boundary, and React never sends a
// boundary-caught render error to window.onerror; this is the only place to see it.
class PreviewErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failure: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { failure: { message: describe(error).message.slice(0, 300) } };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const { message, stack } = describe(error);
    const fullStack = info.componentStack ? `${stack ?? message}\n${info.componentStack}` : stack;
    const filename = window.location.pathname;
    const hook = editorReportHook();
    if (hook) {
      hook({ message, stack: fullStack, filename });
      return;
    }
    post("RUNTIME_ERROR", { message, stack: fullStack, filename, blankScreen: true });
  }

  render() {
    if (!this.state.failure) return this.props.children;
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.detail}>{this.state.failure.message}</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => this.setState({ failure: null })}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

export function LovablePreviewErrorReporter({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!isEmbeddedWeb) return;
    return installGlobalHandlers();
  }, []);

  if (!isEmbeddedWeb) return children;
  return <PreviewErrorBoundary>{children}</PreviewErrorBoundary>;
}

// Plain styles on purpose: this surface must render even when the app's
// styling pipeline is part of what broke.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
    marginBottom: 8,
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
    color: "#666666",
    textAlign: "center",
  },
  button: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#111111",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
});
