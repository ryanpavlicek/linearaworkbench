import { useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { PHONETIC_MAP } from "../data/phoneticMap";
import { Glyph } from "../components/Glyph";

// Type a name or a phrase; get it back in Linear A signs. The syllabary
// writes open CV syllables, so most modern words need adapting — the
// adapter applies the same conventions Linear B scribes used for Greek
// (echo vowels inside clusters, dropped final consonants, r for l, p
// for b…) and shows every change it made. A toy with a real lesson in
// it: the adaptations ARE how syllabaries swallow foreign words.

interface Adapted {
  syllables: { value: string; label: string | null }[];
  notes: string[];
}

export default function WriteLinearA() {
  const corpus = useWorkbench((s) => s.corpus);
  const [text, setText] = useState("ariadne");

  // value (lowercase, e.g. "ku") → sign label, preferring corpus-frequent
  // signs when several labels share a value.
  const valueToLabel = useMemo(() => {
    const m = new Map<string, string>();
    const totals = new Map<string, number>();
    for (const s of corpus.signs) totals.set(s.label, s.total);
    for (const [label, value] of Object.entries(PHONETIC_MAP)) {
      const v = value.toLowerCase();
      const cur = m.get(v);
      if (!cur || (totals.get(label) ?? 0) > (totals.get(cur) ?? 0))
        m.set(v, label);
    }
    return m;
  }, [corpus]);

  const adapted = useMemo<Adapted>(() => {
    const notes = new Set<string>();
    let s = text.toLowerCase().replace(/[^a-z]/g, "");
    if (!s) return { syllables: [], notes: [] };
    // Sound substitutions the script forces (Linear B conventions).
    const subs: [RegExp, string, string][] = [
      [/l/g, "r", "the script has one liquid series — l is written r"],
      [/b/g, "p", "no voiced labial series — b is written p"],
      [/g/g, "k", "no voiced velar series — g is written k"],
      [/c(?=[eiy])/g, "s", "soft c is written s"],
      [/c/g, "k", "hard c is written k"],
      [/v/g, "w", "v is written w"],
      [/f/g, "p", "no f — written p"],
      [/h/g, "", "no standalone h — dropped"],
      [/x/g, "ks", "x unpacks to k+s"],
      [/y/g, "i", "y is written as the vowel i"],
    ];
    for (const [re, rep, note] of subs) {
      if (re.test(s)) {
        notes.add(note);
        s = s.replace(re, rep);
      }
    }
    // Build CV syllables left to right: C+V → one sign; a consonant with
    // no following vowel takes an echo of the NEXT vowel (or drops
    // word-finally except s? Linear B drops final consonants entirely).
    const vowels = "aeiou";
    const out: { value: string; label: string | null }[] = [];
    let i = 0;
    const vowelAfter = (k: number) => {
      for (let j = k; j < s.length; j++)
        if (vowels.includes(s[j])) return s[j];
      return null;
    };
    while (i < s.length) {
      const c = s[i];
      if (vowels.includes(c)) {
        out.push({ value: c, label: valueToLabel.get(c) ?? null });
        i++;
        continue;
      }
      const next = s[i + 1];
      if (next && vowels.includes(next)) {
        out.push({
          value: c + next,
          label: valueToLabel.get(c + next) ?? null,
        });
        i += 2;
        continue;
      }
      // Consonant cluster or final consonant.
      if (i === s.length - 1) {
        notes.add(`final ${c} is dropped (the script writes open syllables)`);
        i++;
        continue;
      }
      const echo = vowelAfter(i + 1) ?? "a";
      notes.add(
        `${c}${s[i + 1] ?? ""}… is a cluster — ${c} takes an echo vowel (${c}${echo})`,
      );
      out.push({
        value: c + echo,
        label: valueToLabel.get(c + echo) ?? null,
      });
      i++;
    }
    return { syllables: out, notes: [...notes] };
  }, [text, valueToLabel]);

  const translit = adapted.syllables
    .map((s) => s.label ?? `(${s.value}?)`)
    .join("-");

  return (
    <div className="panel" style={{ maxWidth: 860 }}>
      <h2>Write in Linear A</h2>
      <div className="callout">
        <h4>Your name, four thousand years early</h4>
        <p>
          Linear A writes open syllables — a consonant plus a vowel — using
          the sound values conventionally carried over from Linear B. Most
          modern words don't fit, and that's the lesson: the adapter below
          applies the same rules Mycenaean scribes used to squeeze Greek
          into the syllabary (echo vowels inside clusters, dropped final
          consonants, r for l) and tells you every liberty it took. Signs
          whose value has no Linear A sign show as gaps.
        </p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="type a name or word…"
          style={{ flex: 1, minWidth: 200, fontSize: 16 }}
          maxLength={40}
        />
      </div>

      {adapted.syllables.length > 0 && (
        <div className="card">
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              alignItems: "flex-end",
              padding: "10px 0",
            }}
          >
            {adapted.syllables.map((syl, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                {syl.label ? (
                  <>
                    <div>
                      <Glyph sign={syl.label} size={44} />
                    </div>
                    <div className="dim" style={{ fontSize: 11 }}>
                      {syl.label}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        border: "1px dashed var(--border-strong)",
                        borderRadius: 4,
                        display: "grid",
                        placeItems: "center",
                        color: "var(--text-muted)",
                      }}
                      title={`No sign carries the value "${syl.value}" in the conventional readings`}
                    >
                      ?
                    </div>
                    <div className="dim" style={{ fontSize: 11 }}>
                      {syl.value}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div
            style={{ fontFamily: "var(--mono)", fontSize: 14, marginBottom: 8 }}
          >
            {translit}
          </div>
          {adapted.notes.length > 0 && (
            <div className="dim" style={{ fontSize: 12 }}>
              <b>What the script forced:</b>
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {adapted.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            Rendering uses the conventional AB sound values — how a sign
            actually sounded in the Minoan language is an open question;
            this is a faithful game, not a translation.
          </div>
        </div>
      )}
    </div>
  );
}
