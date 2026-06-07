// Presentational primitives + the Section type shared by the help content.
// Extracted from Help.tsx so the component file stays lean and the bulk help
// CONTENT lives in helpSections.tsx.
import { type ReactNode } from "react";
import { useWorkbench } from "../../store/workbench";
import type { ModuleId, ModuleIntent } from "../../lib/types";

export interface Section {
  id: string;
  title: string;
  group: string;
  body: ReactNode;
  keywords: string;
}

// Smooth-scroll to another section inside this same help page.
export function HelpLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a
      href={`#help-${to}`}
      onClick={(e) => {
        e.preventDefault();
        document
          .getElementById(`help-${to}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      style={{
        color: "var(--ac)",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
        textUnderlineOffset: 2,
        cursor: "pointer",
      }}
    >
      {children}
    </a>
  );
}

// Navigate to a module in the workbench, optionally with intent (tab pre-
// selection etc). Renders like a link so it's discoverable in prose.
export function ModuleLink({
  to,
  intent,
  children,
}: {
  to: ModuleId;
  intent?: ModuleIntent;
  children: ReactNode;
}) {
  const setActive = useWorkbench((s) => s.setActiveModule);
  return (
    <a
      onClick={(e) => {
        e.preventDefault();
        setActive(to, intent);
      }}
      style={{
        color: "var(--ac)",
        textDecoration: "underline",
        textUnderlineOffset: 2,
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      {children}
    </a>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd
    style={{
      font: "500 11px var(--mono)",
      background: "var(--surface-2)",
      border: "1px solid var(--border-strong)",
      borderRadius: 3,
      padding: "1px 6px",
      color: "var(--text)",
    }}
  >
    {children}
  </kbd>
);

export const Tip = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      padding: "8px 12px",
      background: "#3ddc910c",
      borderLeft: "3px solid var(--gn)",
      borderRadius: 4,
      margin: "8px 0",
      fontFamily: "var(--serif)",
      fontSize: 13,
      color: "var(--text-dim)",
    }}
  >
    <b style={{ color: "var(--gn)", fontFamily: "var(--sans)", fontSize: 10 }}>
      TIP ·{" "}
    </b>
    {children}
  </div>
);

export const Note = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      padding: "8px 12px",
      background: "#f0b14b0c",
      borderLeft: "3px solid var(--am)",
      borderRadius: 4,
      margin: "8px 0",
      fontFamily: "var(--serif)",
      fontSize: 13,
      color: "var(--text-dim)",
    }}
  >
    <b style={{ color: "var(--am)", fontFamily: "var(--sans)", fontSize: 10 }}>
      NOTE ·{" "}
    </b>
    {children}
  </div>
);

export const Btn = ({ children }: { children: ReactNode }) => (
  <span
    style={{
      display: "inline-block",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: 3,
      padding: "1px 6px",
      font: "500 11px var(--sans)",
      color: "var(--text)",
    }}
  >
    {children}
  </span>
);

export const P = ({ children }: { children: ReactNode }) => (
  <p
    style={{
      fontFamily: "var(--serif)",
      fontSize: 14,
      lineHeight: 1.7,
      color: "var(--text-dim)",
      margin: "8px 0",
    }}
  >
    {children}
  </p>
);

export const H3 = ({ children }: { children: ReactNode }) => (
  <h3
    style={{
      font: "500 14px var(--sans)",
      color: "var(--text)",
      marginTop: 14,
      marginBottom: 4,
    }}
  >
    {children}
  </h3>
);
