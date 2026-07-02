// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import DataExport from "./DataExport";
import { loadRealCorpus } from "../test/corpusFixture";
import { downloadFile } from "../lib/helpers";

// Capture the exported CSV instead of driving a real browser download.
vi.mock("../lib/helpers", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/helpers")>();
  return { ...mod, downloadFile: vi.fn() };
});

beforeAll(() => loadRealCorpus());
afterEach(() => {
  cleanup();
  vi.mocked(downloadFile).mockClear();
});

describe("DataExport — sign concordance CSV keeps subscripted signs distinct", () => {
  it("exports '?' for RA₂ and the attested value for RA", () => {
    render(<DataExport />);
    const card = screen.getByText("Sign concordance").closest(".card")!;
    fireEvent.click(card.querySelector("button")!);

    const calls = vi.mocked(downloadFile).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe("linear_a_signs.csv");

    const lines = String(calls[0][1]).split("\n");
    expect(lines[0]).toBe("sign,phonetic,total,initial,medial,final");
    const phoneticOf = (sign: string) =>
      lines.find((l) => l.startsWith(sign + ","))?.split(",")[1];

    // Subscripted signs no longer borrow the plain-series value…
    expect(phoneticOf("RA₂")).toBe("?");
    expect(phoneticOf("PU₂")).toBe("?");
    // …while the plain series and unread labels are unchanged.
    expect(phoneticOf("RA")).toBe("ra");
    expect(phoneticOf("*301")).toBe("?");
  });
});
