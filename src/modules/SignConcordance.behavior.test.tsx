// @vitest-environment jsdom
import "../test/jsdomPolyfills";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SignConcordance from "./SignConcordance";
import { loadRealCorpus } from "../test/corpusFixture";

beforeAll(() => loadRealCorpus());
afterEach(cleanup);

const signCell = (row: Element) =>
  row.querySelector("td:first-child b")!.textContent;
const phoneticCell = (row: Element) =>
  row.querySelectorAll("td")[1].textContent;

describe("SignConcordance — subscripted signs are distinct signs", () => {
  it("RA₂ has no phonetic value while RA reads ra", () => {
    const { container } = render(<SignConcordance />);
    const input = screen.getByPlaceholderText(/filter signs/i);

    fireEvent.change(input, { target: { value: "RA₂" } });
    let rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows.length).toBe(1);
    expect(signCell(rows[0])).toBe("RA₂");
    // The old lookup stripped the subscript and showed RA's "ra" here.
    expect(phoneticCell(rows[0])).toBe("?");

    fireEvent.change(input, { target: { value: "RA" } });
    rows = Array.from(container.querySelectorAll("tbody tr"));
    const ra = rows.find((r) => signCell(r) === "RA");
    expect(ra).toBeTruthy();
    expect(phoneticCell(ra!)).toBe("ra");
  });

  it("the AB-shared filter excludes subscripted signs without a value", () => {
    const { container } = render(<SignConcordance />);
    fireEvent.change(screen.getByPlaceholderText(/filter signs/i), {
      target: { value: "RA" },
    });
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);

    const signs = Array.from(container.querySelectorAll("tbody tr")).map(
      signCell,
    );
    expect(signs).toContain("RA");
    expect(signs).not.toContain("RA₂");
  });
});
