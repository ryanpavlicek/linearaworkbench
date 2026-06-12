// Generate runnable pyaegean code from workbench state, so a browser
// exploration can continue as a scripted, citable analysis. pyaegean
// (pip install pyaegean) ports this workbench's Linear A analysis layer —
// same bundled corpus, same query field ids, parity-tested against shared
// expected values — which is what makes this translation mechanical.
import type { FilterRow } from "./queryEngine";

function pyValue(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  return JSON.stringify(String(v ?? ""));
}

/** Python that loads the corpus and fetches one inscription. */
export function inscriptionSnippet(id: string): string {
  return [
    "import aegean",
    "",
    'corpus = aegean.load("lineara")',
    `ins = corpus.get(${JSON.stringify(id)})`,
    "print(ins.id, ins.meta.site, len(ins.words))",
  ].join("\n");
}

/**
 * Python that reproduces a Query Builder query via pyaegean's ported
 * predicate engine. Field ids and connector/negate semantics are identical
 * on both sides; `has-annotation` rows are workbench-local user state and
 * are dropped with a note.
 */
export function querySnippet(
  filters: FilterRow[],
  output: "inscriptions" | "words",
): string {
  const rows: string[] = [];
  let droppedAnnotation = false;
  filters.forEach((f, i) => {
    if (f.field === "has-annotation") {
      droppedAnnotation = true;
      return;
    }
    const args = [JSON.stringify(f.field), pyValue(f.value)];
    if (i > 0 && f.connector === "or") args.push('connector="or"');
    if (f.negate) args.push("negate=True");
    rows.push(`        FilterRow(${args.join(", ")}),`);
  });

  const lines = [
    "import aegean",
    "from aegean.analysis import FilterRow",
    "",
    'corpus = aegean.load("lineara")',
  ];
  if (droppedAnnotation) {
    lines.push(
      "# 'has-annotation' rows are workbench-local annotations and were omitted.",
    );
  }
  lines.push("results = corpus.query(", "    [", ...rows, "    ],");
  lines.push(`    output=${JSON.stringify(output)},`, ")");
  if (output === "words") {
    lines.push("for word, count in results.words:", "    print(word, count)");
  } else {
    lines.push(
      "for doc in results.inscriptions:",
      "    print(doc.id, doc.meta.site)",
    );
  }
  return lines.join("\n");
}
