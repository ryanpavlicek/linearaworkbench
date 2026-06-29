// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildBackup,
  applyBackup,
  isBackupFile,
  clearAllWorkbenchData,
  BACKUP_KIND,
} from "./backup";

const PREFIX = "linear-a-workbench:";

beforeEach(() => {
  localStorage.clear();
});

describe("buildBackup -> applyBackup round-trip", () => {
  it("restores a bare-string value and a JSON value byte-identically", () => {
    // The headline regression: a bare (non-JSON) string and a real JSON value
    // stored side by side must both come back exactly. The bare string "hello"
    // (no surrounding quotes) used to be JSON.parse-attempted, fall back to the
    // raw string, and survive — but the genuinely lossy partner case below is
    // the one that broke the contract.
    localStorage.setItem(PREFIX + "note", "hello"); // bare string
    localStorage.setItem(PREFIX + "collections", '[{"id":"c1"}]'); // JSON value

    const file = buildBackup();
    expect(isBackupFile(file)).toBe(true);
    // The JSON value is lifted into a real parsed value (human-readable file).
    expect(file.data["collections"]).toEqual([{ id: "c1" }]);
    // The bare string stays a string.
    expect(file.data["note"]).toBe("hello");

    // Wipe, then restore and assert localStorage matches the originals exactly.
    localStorage.clear();
    const report = applyBackup(file, "replace");
    expect(report.applied).toBe(2);
    expect(localStorage.getItem(PREFIX + "note")).toBe("hello");
    expect(localStorage.getItem(PREFIX + "collections")).toBe('[{"id":"c1"}]');
  });

  it("round-trips a bare string that is itself valid JSON (the lossy case)", () => {
    // A localStorage value whose RAW TEXT is a quoted JSON string, e.g. the 7
    // characters "hello" including the literal double-quotes. The old code
    // JSON.parsed it to `hello`, then applyBackup wrote `hello` back — dropping
    // the quotes. Likewise a raw value that is a JSON-encoded number/bool as
    // text. All must survive byte-for-byte.
    const cases: Record<string, string> = {
      quotedString: '"hello"', // raw text includes the quote characters
      numberText: "42",
      boolText: "true",
      nullText: "null",
      quotedNumber: '"42"',
      // Non-canonical JSON text must NOT be silently re-formatted on restore.
      spacedArray: "[1, 2]",
      floatText: "1.0",
      expText: "1e3",
      // Plainly non-JSON strings.
      plain: "12abc",
      truncated: "[broken",
      empty: "",
      whitespace: "  ",
    };
    for (const [k, v] of Object.entries(cases)) {
      localStorage.setItem(PREFIX + k, v);
    }

    const file = buildBackup();
    localStorage.clear();
    const report = applyBackup(file, "replace");

    expect(report.applied).toBe(Object.keys(cases).length);
    expect(report.skipped).toBe(0);
    for (const [k, v] of Object.entries(cases)) {
      expect(localStorage.getItem(PREFIX + k)).toBe(v);
    }
  });

  it("merge mode overwrites only backed-up keys and leaves others intact", () => {
    localStorage.setItem(PREFIX + "a", '"x"'); // quoted-string raw
    const file = buildBackup();

    localStorage.clear();
    localStorage.setItem(PREFIX + "a", "stale");
    localStorage.setItem(PREFIX + "b", "kept");

    const report = applyBackup(file, "merge");
    expect(report.cleared).toBe(0);
    expect(report.applied).toBe(1);
    expect(localStorage.getItem(PREFIX + "a")).toBe('"x"'); // restored exactly
    expect(localStorage.getItem(PREFIX + "b")).toBe("kept"); // untouched
  });

  it("only snapshots prefixed keys", () => {
    localStorage.setItem(PREFIX + "mine", "1");
    localStorage.setItem("other-app", "2");
    const file = buildBackup();
    expect(Object.keys(file.data)).toEqual(["mine"]);
  });
});

describe("isBackupFile", () => {
  it("accepts a well-formed backup and rejects malformed input", () => {
    const good = buildBackup();
    expect(isBackupFile(good)).toBe(true);
    expect(isBackupFile(null)).toBe(false);
    expect(isBackupFile({ kind: "wrong", version: 1, data: {} })).toBe(false);
    expect(isBackupFile({ kind: BACKUP_KIND, version: 999, data: {} })).toBe(
      false,
    );
    expect(isBackupFile({ kind: BACKUP_KIND, version: 1 })).toBe(false);
  });
});

describe("clearAllWorkbenchData", () => {
  it("removes only prefixed keys and returns the count", () => {
    localStorage.setItem(PREFIX + "a", "1");
    localStorage.setItem(PREFIX + "b", "2");
    localStorage.setItem("other-app", "keep");
    expect(clearAllWorkbenchData()).toBe(2);
    expect(localStorage.getItem(PREFIX + "a")).toBeNull();
    expect(localStorage.getItem("other-app")).toBe("keep");
  });
});
