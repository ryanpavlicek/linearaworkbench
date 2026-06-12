// The full in-app help content — a static array of sections rendered by
// Help.tsx. Kept as a dedicated data module (separated from component logic)
// so Help.tsx is small and this stays a pure content catalogue.
import {
  HelpLink,
  ModuleLink,
  Kbd,
  Tip,
  Note,
  Btn,
  P,
  H3,
  type Section,
} from "./helpPrimitives";
import { GORILA_CEFAEL_URL } from "../../lib/citations";

export const SECTIONS: Section[] = [
  // ─────────────────────────── ORIENTATION ─────────────────────────────
  {
    id: "overview",
    group: "Orientation",
    title: "What this is",
    keywords: "intro overview linear a minoan",
    body: (
      <>
        <P>
          This workbench is a working environment for studying the Linear A
          corpus — the undeciphered Bronze Age script used on Crete and
          neighboring islands from roughly 1800 to 1450 BCE. About 1,700
          inscriptions survive, almost entirely on clay tablets, sealings, and
          libation tables. We can read individual <em>sounds</em> (because
          most of the signs are shared with the later, deciphered Linear B
          syllabary), but we don't know the language those sounds spell.
        </P>
        <P>
          The corpus is bundled with the app so it loads instantly and works
          offline. Source: the public{" "}
          <a
            href="https://github.com/mwenge/lineara.xyz"
            target="_blank"
            rel="noreferrer"
          >
            mwenge/lineara.xyz
          </a>{" "}
          repository, which is itself derived from the GORILA corpus
          publications.
        </P>
        <Tip>
          You don't need to be a linguist to use this. Start by clicking
          around — every word and inscription is interactive, and hovering
          shows a quick preview.
        </Tip>
      </>
    ),
  },
  {
    id: "interface",
    group: "Orientation",
    title: "The interface",
    keywords: "layout top bar sidebar main pin rail footer",
    body: (
      <>
        <H3>Top bar</H3>
        <P>
          Shows corpus stats, your annotation count (a clickable chip if you
          have any), a <Btn>⚙ Display</Btn> settings popover, and a link to
          the upstream corpus source.
        </P>
        <H3>Sidebar (left)</H3>
        <P>
          Lists every module, grouped by category — <b>Research</b> (your
          workspace, including Corpus Search and Corpus Browser) at the top,
          then Vocabulary, Signs &amp; structure, Accounts &amp; content,
          Hypothesis testing, and Distribution. Above each module's content
          you'll see a small <b>Descriptive</b> (green) or <b>Exploratory</b>{" "}
          (amber) badge — descriptive modules report direct counts and
          structural observations from the corpus; exploratory modules
          produce heuristic / interpretive output that should be treated as
          hypothesis rather than evidence. Hover the badge for the full
          calibration; the per-module Help pages and the{" "}
          <ModuleLink to="methodology">Methodology page</ModuleLink>{" "}
          spell out the reasoning behind each one.
          Click any module to switch to it; the active module is
          highlighted with a blue left accent. Click a group header (or its{" "}
          ▾/▸ chevron) to collapse or expand that section — your collapsed
          sections are remembered between visits.
        </P>
        <P>
          On phones and small tablets the sidebar collapses into a slide-in
          drawer — tap the <Btn>☰</Btn> menu button in the top bar to open
          it, tap any module to navigate (drawer closes automatically), or
          tap outside it to dismiss.
        </P>
        <H3>Main area</H3>
        <P>
          The active module renders here. Every module begins with a short
          callout explaining what it does, then controls and results.
        </P>
        <H3>Working with tables &amp; lists</H3>
        <P>
          Across the analysis modules, result tables share the same controls.
          Click any underlined column header to sort by it; click again to
          flip ascending/descending (the active column shows a ▾/▴ arrow).
          Toolbar inputs filter the rows in place — a free-text search, plus
          metric thresholds like <em>count ≥</em>, <em>sites ≥</em>, minimum
          word length, category, or position bias depending on the module.
          Filters compound, the row-count note updates live, and{" "}
          <b>Export CSV</b> and <b>Save to findings</b> always reflect the
          current filtered, sorted view — so what you export is exactly what
          you see.
        </P>
        <H3>Pin rail (right, when active)</H3>
        <P>
          Persistent dock for words and inscriptions you want to keep in
          view. Hidden by default; appears when you pin something. See the{" "}
          <HelpLink to="pin-rail">Pin rail</HelpLink> section below.
          (Hidden entirely on phone-size screens; pinned items remain
          tracked but the rail itself is desktop-only.)
        </P>
        <H3>Footer</H3>
        <P>
          Compact status bar with keyboard shortcut reminders. Toast
          notifications float above the footer to confirm exports, saves, and
          undo actions.
        </P>
      </>
    ),
  },
  {
    id: "corpus-scope",
    group: "Orientation",
    title: "Corpus scope",
    keywords:
      "scope filter site period scribe support collection subset restrict global",
    body: (
      <>
        <P>
          The <Btn>◇ Scope</Btn> button in the top bar applies a{" "}
          <b>workbench-wide filter</b> to the corpus. Pick a site, dating
          period, scribe, support type, and/or a saved collection, and{" "}
          <em>every</em> analysis module recomputes over just those
          inscriptions — word frequencies, co-occurrence and PMI, n-grams,
          positional grammar, the findspot map, scribal profiles, lexical
          statistics, and the rest.
        </P>
        <P>
          The selectors combine with <b>AND</b>: site = Haghia Triada{" "}
          <em>and</em> period = LM IB shows only the tablets that are both. The
          button turns into <Btn>◆ Scope</Btn> and shows the active filter plus
          how many inscriptions match; the popover repeats the count as{" "}
          <em>N of M</em>. Click <Btn>Clear scope</Btn> to return to the whole
          corpus.
        </P>
        <Tip>
          A few modules deliberately <b>ignore</b> the scope because it would
          undercut what they do: the{" "}
          <ModuleLink to="diachronic">Diachronic comparison</ModuleLink> always needs
          both MM and LM phases, the <ModuleLink to="signref">Sign Inventory</ModuleLink>{" "}
          is a reference signary, <ModuleLink to="search">Corpus Search</ModuleLink>{" "}
          and the <ModuleLink to="query">Query Builder</ModuleLink> are their
          own filters, and the cross-language and sound-shift tools work on sign
          values rather than corpus distribution. Scope is session-only — it
          resets when you reload.
        </Tip>
      </>
    ),
  },
  {
    id: "quickstart",
    group: "Orientation",
    title: "Quick start",
    keywords: "first time tutorial getting started",
    body: (
      <>
        <P>
          Three things to try right now to get a feel for the workbench:
        </P>
        <ol
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            Open <ModuleLink to="search">Corpus Search</ModuleLink>, type{" "}
            <code>KU-RO</code>, and click any result. You'll see the
            inscription detail with its Linear A glyphs, transliteration,
            scribe, and (if available) the facsimile image.
          </li>
          <li>
            Open <ModuleLink to="signref">Sign Inventory</ModuleLink> to see
            every Linear A sign with its Unicode glyph and Linear B value
            (where the sign is shared between the two scripts).
          </li>
          <li>
            Open <ModuleLink to="comp">Cross-Linguistic</ModuleLink>, enter{" "}
            <code>KU-RO</code>, and click the{" "}
            <ModuleLink to="comp" intent={{ tab: "matrix" }}>
              Alignment matrix
            </ModuleLink>{" "}
            tab. You'll see how Linear A phonetics match each reference
            language phoneme-by-phoneme.
          </li>
        </ol>
        <Tip>
          Many things you click open a detail modal. Press <Kbd>Esc</Kbd> or
          click outside to close. If you want a target to stick around, use
          the <Btn>☆ Pin</Btn> button — see{" "}
          <HelpLink to="pin-rail">Pin rail</HelpLink>.
        </Tip>
      </>
    ),
  },

  // ─────────────────────────── BASIC UX ───────────────────────────────
  {
    id: "display",
    group: "Basics",
    title: "Display settings",
    keywords:
      "settings density glyphs phonetic compact hover inline hypothesis annotate theme dark light",
    body: (
      <>
        <P>
          The <Btn>⚙ Display</Btn> popover (top right) controls how dense and
          how decorated the workbench feels. All settings persist in your
          browser.
        </P>
        <H3>Theme</H3>
        <P>
          Switch between the default <b>🌙 Dark</b> theme and a <b>☀ Light</b>{" "}
          theme. The light theme uses higher-contrast accent colors so charts
          and tables stay legible on paper or in a sunlit room. The map
          renders with a sea/land palette tuned to whichever theme is active,
          and the HTML report export is always light (so it prints cleanly).
        </P>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>Glyphs inline</b> — render the actual Linear A glyph next to
            every word transliteration. Useful when you want to keep visual
            memory of how words look, but it makes everything wider.
          </li>
          <li>
            <b>Phonetic inline</b> — render the phonetic value (e.g.{" "}
            <code>/kuro/</code>) next to every word. Useful while testing
            Sound Shift hypotheses.
          </li>
          <li>
            <b>Annotation chips</b> — small colored dot next to anything
            you've annotated. Color encodes confidence (green / amber /
            gray). Disable if you find them noisy.
          </li>
          <li>
            <b>Inline word tools ✎</b> — puts a small ✎ control on{" "}
            <em>every</em> word so you can <b>annotate</b> (proposed meaning +
            confidence + notes), <b>add it to a collection</b>, and <b>pin</b>{" "}
            it — all in place, without opening its detail view. <b>On by
            default</b> and kept visually quiet (a faint glyph that brightens on
            hover); it supersedes the annotation chip, since it already shows
            your proposed meaning. Turn it off for a cleaner read-only view.
            Everything captured flows into your Research Report.
          </li>
          <li>
            <b>Hover previews</b> — tooltip-card on hover with quick stats.
            300 ms delay. Disable for slower machines or dense tables.
          </li>
          <li>
            <b>Compact tables</b> — tighter row padding throughout. Lets
            more rows fit on screen at the cost of tap target size.
          </li>
          <li>
            <b>Pin rail visible</b> — toggle the right rail visibility
            without unpinning anything.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "pin-rail",
    group: "Basics",
    title: "Pin rail",
    keywords: "pin rail bookmark persist sticky right",
    body: (
      <>
        <P>
          The pin rail is a persistent right-side dock for words and
          inscriptions you want to keep in view while exploring other
          modules. Think of it as your working bench.
        </P>
        <H3>Pin something</H3>
        <P>
          Click any word or inscription to open its detail modal, then click{" "}
          <Btn>☆ Pin</Btn> in the modal header. The rail appears (or grows)
          on the right side.
        </P>
        <H3>Resize the rail</H3>
        <P>
          Drag the thin vertical handle on the left edge of the rail
          left/right to resize it (220–600 px). Width persists.
        </P>
        <H3>Unpin or clear</H3>
        <P>
          Each pin card has an <Btn>✕</Btn> button to unpin just that item.
          The rail header has <Btn>Clear</Btn> to unpin everything, and a
          second <Btn>✕</Btn> to hide the rail entirely (toggle it back via
          Display settings).
        </P>
        <Tip>
          Pin a word from <ModuleLink to="freq">Word Frequency</ModuleLink>, then click through other
          modules — the word stays visible. Pin two or three at once to do
          side-by-side comparison without leaving your current view.
        </Tip>
      </>
    ),
  },
  {
    id: "hover",
    group: "Basics",
    title: "Hover previews",
    keywords: "hover preview tooltip card",
    body: (
      <>
        <P>
          Hover any word or inscription link for ~300 ms and a small preview
          card appears with quick stats: count, sites, top co-occurrences
          (for words) or site, period, scribe, glyph snippet (for
          inscriptions).
        </P>
        <P>
          Click the link to upgrade to the full detail modal. The preview
          is just a peek — it doesn't lock or persist.
        </P>
        <Note>
          Turn off via Display settings if you find them distracting.
        </Note>
      </>
    ),
  },
  {
    id: "detail",
    group: "Basics",
    title: "Detail modal (words & inscriptions)",
    keywords: "modal detail popup word inscription",
    body: (
      <>
        <P>
          Click any word link or inscription ID to open its detail modal.
          Press <Kbd>Esc</Kbd> to close.
        </P>
        <H3>Word detail</H3>
        <P>
          Shows the word's individual signs as glyphs with phonetic
          readings, root cognates (other words sharing its consonant
          skeleton), top co-occurrences, and the inscriptions it appears in
          with the word highlighted in context.
        </P>
        <H3>Inscription detail</H3>
        <P>
          Shows the full glyph string in Noto Sans Linear A, the
          transliteration with frequency-coded coloring, scribe and dating
          period, and toggleable facsimile/photograph images from the
          upstream corpus.
        </P>
        <H3>Navigator</H3>
        <P>
          In the inscription detail header, a small navigator lets you step
          to the previous/next inscription by corpus order, same site, same
          scribe, or same period. Keyboard: <Kbd>Alt + ←</Kbd> /{" "}
          <Kbd>Alt + →</Kbd>.
        </P>
        <H3>Pin & Collection buttons</H3>
        <P>
          The header also has <Btn>☆ Pin</Btn> and <Btn>⊞ Collection</Btn>{" "}
          buttons to keep this target accessible later.
        </P>
        <H3>External references</H3>
        <P>
          Every inscription detail body renders the bundled per-tablet{" "}
          <b>Commentary</b> inline (mirrored from Younger's pre-2024 KU site
          via lineara.xyz, themed to match the app). The header also has{" "}
          <Btn>Commentary ↗</Btn> to open the raw file in a standalone tab
          and <Btn>Paleography ↗</Btn> for SigLA's per-scribe sign-shape
          database. Younger's current material lives on academia.edu
          (linked from the commentary panel and the About dialog).
        </P>
        <H3>Annotation editor</H3>
        <P>
          At the bottom of every detail modal: attach a proposed meaning, a
          confidence level (low/medium/high), and free-text notes. Saves
          automatically on blur.
        </P>
      </>
    ),
  },
  {
    id: "annotations",
    group: "Basics",
    title: "Annotations",
    keywords: "annotation notes proposed meaning confidence",
    body: (
      <>
        <P>
          Annotations are your decipherment notebook. Attach a proposed
          reading, a confidence rating, and any free-text reasoning to any
          word or inscription. They persist in your browser's localStorage
          and surface inline throughout the workbench as colored dot chips.
        </P>
        <H3>Create one</H3>
        <P>
          Open the detail modal for any word or inscription. Scroll to the{" "}
          <b>Annotation</b> section at the bottom. Fill in proposed meaning,
          pick confidence (low / medium / high), and add notes. Click
          anywhere outside to save.
        </P>
        <H3>See all annotations</H3>
        <P>
          The <ModuleLink to="annot">Annotations</ModuleLink> module lists every annotation you've made,
          filterable by kind (word / inscription) and searchable by any
          field. Click <Btn>Open</Btn> to jump back to the target.
        </P>
        <H3>Confidence color coding</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <span style={{ color: "var(--gn)" }}>● High</span> — confident
            you've got the right reading
          </li>
          <li>
            <span style={{ color: "var(--am)" }}>● Medium</span> — plausible
            but not certain
          </li>
          <li>
            <span style={{ color: "var(--text-muted)" }}>● Low</span> —
            speculative hypothesis worth tracking
          </li>
        </ul>
        <H3>Share / back up</H3>
        <P>
          The <ModuleLink to="annot">Annotations</ModuleLink> module has <Btn>Export JSON</Btn> and{" "}
          <Btn>Import</Btn> buttons. Importing prompts whether to merge or
          replace your existing annotations.
        </P>
        <Tip>
          Annotation changes are undoable with <Kbd>Ctrl + Z</Kbd>.
        </Tip>
      </>
    ),
  },
  {
    id: "collections",
    group: "Basics",
    title: "Collections (bookmarks)",
    keywords: "collection bookmark group set",
    body: (
      <>
        <P>
          Collections are named bookmark sets — for example "candidate
          religious vocabulary", "HT scribe 21 tablets", or "words to
          revisit". Persist in localStorage.
        </P>
        <H3>Create & populate</H3>
        <P>
          Open any word or inscription detail, click <Btn>⊞ Collection</Btn>{" "}
          in the header, type a new collection name, and hit{" "}
          <Kbd>Enter</Kbd>. The current target is added. Toggle membership
          for other targets the same way.
        </P>
        <H3>Manage</H3>
        <P>
          The <ModuleLink to="collections">Collections</ModuleLink> module lists every collection with its
          items. Click any item to open it. Click the collection name to
          rename it. Export the whole set as JSON.
        </P>
      </>
    ),
  },
  {
    id: "keyboard",
    group: "Basics",
    title: "Keyboard shortcuts",
    keywords: "keyboard shortcut hotkey",
    body: (
      <>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.9,
            color: "var(--text-dim)",
            paddingLeft: 20,
            listStyle: "none",
          }}
        >
          <li>
            <Kbd>Ctrl + K</Kbd> &nbsp;&nbsp;Command palette — jump to any
            module by name
          </li>
          <li>
            <Kbd>Ctrl + /</Kbd> &nbsp;&nbsp;Open Corpus Search
          </li>
          <li>
            <Kbd>Ctrl + Z</Kbd> &nbsp;&nbsp;Undo last reversible action
          </li>
          <li>
            <Kbd>?</Kbd> &nbsp;&nbsp;Open this help page
          </li>
          <li>
            <Kbd>Esc</Kbd> &nbsp;&nbsp;Close detail modal
          </li>
          <li>
            <Kbd>Alt + ←</Kbd> / <Kbd>Alt + →</Kbd> &nbsp;&nbsp;Step
            inscription navigator (in inscription detail)
          </li>
        </ul>
        <Note>
          Shortcuts are suppressed while typing in inputs, textareas, and
          selects.
        </Note>
      </>
    ),
  },
  {
    id: "undo",
    group: "Basics",
    title: "Undo history",
    keywords: "undo ctrl z reversible",
    body: (
      <>
        <P>
          The last ~30 reversible actions can be undone with{" "}
          <Kbd>Ctrl + Z</Kbd>. A toast confirms what was undone.
        </P>
        <P>What's undoable: pin/unpin, create/edit/delete annotation.</P>
        <P>
          What's not (yet): collection edits, hypothesis overrides, query
          builder changes. Those persist directly.
        </P>
      </>
    ),
  },

  // ─────────────────────────── MODULES ────────────────────────────────
  {
    id: "mod-search",
    group: "Analysis modules",
    title: "Corpus Search",
    keywords: "search filter find inscription",
    body: (
      <>
        <P>
          The default landing module. Find inscriptions by ID, by any word
          they contain, or by site / support / dating period / scribe.
        </P>
        <H3>Use it for</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>Looking up a specific tablet (e.g. "HT1")</li>
          <li>
            All inscriptions from one site (e.g. all Haghia Triada tablets)
          </li>
          <li>
            All inscriptions containing a word ("show me everywhere KU-RO
            appears")
          </li>
          <li>Combining filters — e.g. all libation tablets from MM IIIA</li>
        </ul>
        <H3>Search by glyph (🔣)</H3>
        <P>
          Click the <Btn>🔣 By glyph</Btn> button next to the search box to
          open a glyph keyboard. Tap signs from the grid to assemble a sign
          sequence (e.g. tap <code>KA</code>, then <code>RU</code>, then{" "}
          <code>*301</code> → <code>KA-RU-*301</code>) and the result is
          fed into Corpus Search. Useful when you have a tablet in hand
          and want to find every word containing a specific sign sequence.
          Filter the keyboard by AB-shared vs Linear-A-only signs or
          search by GORILA label / phonetic value.
        </P>
        <Tip>
          For complex queries combining multiple word criteria, use{" "}
          <ModuleLink to="query">Query Builder</ModuleLink> instead. Corpus Search is the lightweight
          version. To <em>browse</em> rather than search, see the{" "}
          <HelpLink to="mod-browse">Corpus Browser</HelpLink>.
        </Tip>
      </>
    ),
  },
  {
    id: "mod-browse",
    group: "Analysis modules",
    title: "Corpus Browser",
    keywords: "browse tablets paginate walk by glyph sign index serendipity",
    body: (
      <>
        <P>
          The "browse, don't search" companion to{" "}
          <ModuleLink to="search">Corpus Search</ModuleLink>. Where Search
          answers "find this", the browser is for orientation and serendipity —
          and it has two tabs.
        </P>
        <H3>Browse corpus</H3>
        <P>
          Page through <em>every</em> inscription with no query needed. Click
          any column header to sort by ID, site, period, scribe, support, or
          token count, and use <Btn>← Prev</Btn> / <Btn>Next →</Btn> to walk the
          pages (50 at a time). Click an ID to open the full detail modal. The
          list respects the active{" "}
          <HelpLink to="corpus-scope">corpus scope</HelpLink>, so scoping to a
          site or period turns this into a focused reading list — and{" "}
          <Btn>Export CSV</Btn> dumps the whole scoped set.
        </P>
        <H3>Preview pane (optional)</H3>
        <P>
          Tick <Btn>☐ Preview pane</Btn> in the toolbar to add a compact
          side-by-side preview of the highlighted row — metadata badges,
          full Linear A glyph string, first three transliterated lines, and
          a small facsimile thumbnail if one is bundled. Clicking anywhere
          in a row selects it for the preview; the <b>Open full detail →</b>{" "}
          button (or clicking the inscription ID, or pressing{" "}
          <kbd>Enter</kbd>) opens the same modal a click on the ID normally
          would. Off by default — the modal stays the primary detail surface
          when you want depth.
        </P>
        <Note>
          With the preview pane on, keyboard nav lights up: <kbd>↑</kbd> /{" "}
          <kbd>↓</kbd> step rows, <kbd>Home</kbd> / <kbd>End</kbd> jump to
          first / last on the current page, <kbd>Enter</kbd> opens the full
          detail modal. Bounds clamp at page edges so you page explicitly
          via <Btn>← Prev</Btn> / <Btn>Next →</Btn> rather than auto-paging
          on key-press. On viewports narrower than ~1100px the preview
          stacks below the table.
        </Note>
        <H3>By glyph</H3>
        <P>
          A sign-indexed view: the left grid lists every signary sign attested
          in scope (ranked by how many tablets carry it). Pick one and the right
          panel shows every word that contains it (with counts) and every
          inscription it appears in — a fast way to ask "where does sign{" "}
          <code>*301</code> actually turn up?". Click through any word or
          inscription to drill in.
        </P>
        <H3>Imagery</H3>
        <P>
          A visual contact sheet of the tablets: a grid of thumbnails you can
          page through, with a toggle for <b>Facsimile</b> (the editorial line
          drawings), <b>Photograph</b>, or <b>Both (pairs)</b> — which shows the
          drawing and photo side by side per tablet. Click any thumbnail for a
          full-size lightbox (Esc or click-away to close); from there{" "}
          <Btn>Open inscription →</Btn> jumps to the full detail view. Like the
          other tabs it respects the active scope, so you can flip through just
          one site's or period's tablets.
        </P>
        <Note>
          Numerals, separators, and ligature fragments are excluded from the
          glyph grid — only catalogued signary signs appear. Imagery loads from
          the configured asset source; if a local mirror isn't populated, some
          thumbnails may be blank.
        </Note>
      </>
    ),
  },
  {
    id: "mod-commentary",
    group: "Analysis modules",
    title: "Commentary Browser",
    keywords:
      "commentary younger ku scholarly browse read inscription notes academia full-text search reference archive",
    body: (
      <>
        <P>
          A standalone read-the-scholarship surface over the{" "}
          <b>1,694 commentary HTML docs</b> bundled in{" "}
          <code>public/upstream/commentary/</code> — John Younger's pre-2024
          KU-era archive, mirrored via mwenge/lineara.xyz. Distinct from the
          inline commentary panel that already sits inside every inscription's{" "}
          detail modal: that surface is "I'm looking at HT13, show me its
          commentary"; this one is "let me read across the archive itself."
        </P>
        <H3>Layout</H3>
        <P>
          Two-pane. The left list shows every doc grouped by site code (HT,
          ARKH, KH, ZA…), with a count badge per site. Click a doc to read it
          on the right pane, themed to match the app palette (the original{" "}
          <code>&lt;font color&gt;</code> highlights are container-scoped, not
          rewritten). The <Btn>standalone ↗</Btn> link opens the raw bundled
          HTML in a new tab if you need an unstyled view.
        </P>
        <H3>Full-text search</H3>
        <P>
          The search box at the top matches against the stripped text of{" "}
          <em>every</em> commentary doc — type "libation" or "Hagia Triada"
          or "KU-RO" and matching docs sort by hit count (the small{" "}
          <code>N×</code> badge on each row). The pipeline is: site filter
          chips → full-text search → group by site. A search index pre-built
          at <code>npm run commentary:index</code> ships as a slim ~558 KB
          JSON; the module loads it once and searches in-memory, so typing
          feels live.
        </P>
        <H3>Cross-link to the corpus</H3>
        <P>
          When the selected doc's ID matches a loaded inscription (e.g.{" "}
          <code>HT1.html</code> → inscription <code>HT1</code>), an{" "}
          <Btn>Open inscription →</Btn> button takes you straight to that
          tablet's detail modal — transliteration, glyphs, facsimile, plus
          the same commentary rendered alongside the data. The archive covers
          more inscriptions than the workbench's loaded corpus (some upstream
          transliterations were skipped), so an italic note flags docs
          without a matching loaded inscription.
        </P>
        <H3>Imagery alongside the commentary</H3>
        <P>
          A 4-way toggle in the right pane — <b>Off</b> /{" "}
          <b>Facsimile</b> / <b>Photograph</b> / <b>Both</b> — pulls the
          matched inscription's editorial line drawing, photograph, or both,
          shown as compact thumbnails above the commentary text (side by side
          when you pick <b>Both</b>). <b>Click either thumbnail</b> to open a
          full-resolution lightbox — Esc or click-away to close, with an{" "}
          <b>open original ↗</b> link for the raw image file. Off by default
          to keep the reading surface uncluttered. Chips for image types that
          aren't bundled for the current inscription disable themselves with a
          tooltip explaining why, and the whole row disables for commentary
          docs that don't map to a loaded inscription at all.
        </P>
        <Note>
          The commentary mirror is a pre-2024 snapshot. Younger has since
          reorganized his Linear A material as PDFs on academia.edu (his
          KU secondary server was retired in 2024). For the most current
          readings, follow the academia.edu link in any doc's footer — this
          archive is preserved for full-text browse and as the stable record
          of what Younger had published before the move.
        </Note>
      </>
    ),
  },
  {
    id: "mod-freq",
    group: "Analysis modules",
    title: "Word Frequency",
    keywords: "frequency count hapax distribution",
    body: (
      <>
        <P>
          Every multi-sign word ranked by attestation count. Shows total
          words, hapax legomena (words attested only once — about half the
          vocabulary), max frequency, and distribution sites.
        </P>
        <H3>Read it as</H3>
        <P>
          The blue bars show frequency as a proportion of the top word. The
          steep dropoff is typical of natural language: a few words dominate
          (likely function words and accounting terms), most are rare.
        </P>
      </>
    ),
  },
  {
    id: "mod-lexstats",
    group: "Analysis modules",
    title: "Lexical Statistics",
    keywords:
      "lexical statistics zipf type token ratio hapax frequency spectrum vocabulary",
    body: (
      <>
        <P>
          Corpus-level vocabulary statistics: type–token ratio, the
          frequency spectrum (how many words occur once, twice, …), and a
          Zipf rank–frequency curve on log-log axes.
        </P>
        <H3>Zipf curve</H3>
        <P>
          Natural-language corpora follow Zipf's law — a word's frequency is
          roughly inversely proportional to its rank, which plots as a
          straight line on log-log axes. The blue observed curve is shown
          against a dashed ideal-Zipf reference; how closely they parallel
          tells you how language-like the frequency distribution is.
        </P>
        <H3>Hapax legomena</H3>
        <P>
          The frequency spectrum's tall first bar is the hapax count — words
          occurring exactly once. A high hapax fraction is expected in small
          corpora and in texts rich in proper names (which Linear A
          administrative tablets are), so this is a useful sanity check on
          the corpus's character.
        </P>
        <H3>Compare with</H3>
        <P>
          The <b>Compare with</b> control overlays a second slice — the whole
          corpus, a chosen site, or a dating period — onto the Zipf chart (in
          purple) and adds a side-by-side stats table (types, tokens, TTR,
          hapax %). The "current view" series respects the global{" "}
          <HelpLink to="corpus-scope">corpus scope</HelpLink>, while the
          comparison slice is taken independently from the full corpus — so you
          can ask "how does this site's vocabulary curve differ from the corpus
          as a whole?".
        </P>
        <Note>
          Computed over multi-sign words only (numerals, separators, and
          single-sign tokens excluded), matching the rest of the workbench.
        </Note>
      </>
    ),
  },
  {
    id: "mod-morph",
    group: "Analysis modules",
    title: "Morphology",
    keywords: "morphology suffix prefix",
    body: (
      <>
        <P>
          Frequency of suffixes (last sign) and prefixes (first sign) across
          multi-sign words. Suffixes that occur on many distinct words are
          candidate inflectional endings; recurring prefixes may be
          derivational morphemes.
        </P>
        <Tip>
          Compare what you find here against the suffix patterns in Linear
          B, which we know are inflectional markers like{" "}
          <code>-(j)o</code> (dative).
        </Tip>
      </>
    ),
  },
  {
    id: "mod-cooc",
    group: "Analysis modules",
    title: "Co-occurrence",
    keywords:
      "co-occurrence collocation pmi log likelihood chi squared significance bonferroni fisher",
    body: (
      <>
        <P>
          Two top-level tabs: <b>Table</b> (the ranked statistics described
          here) and <b>Network graph</b> (a force-directed view of the same
          collocations).
        </P>
        <P>
          Word pairs that appear together within the same inscription. Four
          ranking metrics, each in its own tab:
        </P>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>PMI</b> (pointwise mutual information): how much more often a
            pair co-occurs than chance would predict. Best for finding{" "}
            <em>genuine collocations</em>.
          </li>
          <li>
            <b>G²</b> (log-likelihood): similar to PMI but tolerates rarer
            pairs better. Common in corpus linguistics.
          </li>
          <li>
            <b>Chi² (significance)</b>: Yates-corrected χ² test of
            independence on the 2×2 contingency table. Each pair gets a{" "}
            <b>p-value</b> from the χ² distribution with 1 degree of
            freedom — the probability you'd observe the joint count by
            chance under independence.
          </li>
          <li>
            <b>Raw count</b>: just how often the pair appears together.
            Useful as a sanity check; otherwise tends to surface frequent
            words paired with frequent words.
          </li>
        </ul>
        <H3>p-value and Bonferroni</H3>
        <P>
          The p-value column is always visible. Lower is more significant
          — by convention, p &lt; 0.05 is "statistically significant" and
          p &lt; 0.001 is "highly significant" (color-coded green / amber
          / gray). With thousands of pairs being tested at once, raw p
          values vastly overstate significance because of the
          multiple-comparison problem; the <b>Bonferroni</b> checkbox
          multiplies each p by the number of tests to control the
          family-wise error rate. Leave it on for almost any honest
          analysis.
        </P>
        <H3>sig only</H3>
        <P>
          Filter to pairs with adjusted p &lt; 0.05. Combine with the χ²
          tab to find the genuine statistically-supported collocations.
        </P>
        <H3>Fisher's exact (F button)</H3>
        <P>
          Each row has an <code>F</code> button that computes the{" "}
          <b>Fisher's exact</b> two-sided p-value for that single pair.
          Fisher's is the gold standard for 2×2 tables (especially with
          small expected counts) but is computationally expensive, so it's
          on-demand only. Result appears in a callout below the table.
        </P>
        <H3>95% CI</H3>
        <P>
          Toggle the <Btn>95% CI</Btn> checkbox to show a Wilson-score
          confidence interval on each pair's PMI. Wide intervals mean the
          PMI estimate is unstable (typically because joint counts are
          small). Narrow intervals mean the association is well-supported.
        </P>
        <H3>Min joint</H3>
        <P>
          Filter out pairs that co-occur fewer than N times. Higher
          thresholds give more reliable but fewer results.
        </P>
        <H3>Small-N warning ⚠</H3>
        <P>
          Any pair whose joint count is ≤ 5 gets a small amber{" "}
          <span style={{ color: "var(--am)" }}>⚠</span> next to its joint
          cell. The χ² normal approximation is unreliable below ~5 expected
          per cell, so even an impressively low p value should be
          cross-checked with the <code>F</code> button (Fisher's exact) for
          flagged rows. A footnote appears below the table whenever any
          flagged rows are visible. The flag carries through into the
          captured-report snippet so saved findings preserve the caveat.
        </P>
        <H3>Collocates of a word</H3>
        <P>
          Tick <b>collocates of</b> and type an exact word into the filter to
          switch from the all-pairs table to that word's{" "}
          <em>collocates</em> — every pair it belongs to, ranked by the chosen
          metric, so the other column lists its co-occurrence partners. The
          plain (unticked) filter still does loose substring matching on either
          word.
        </P>
      </>
    ),
  },
  {
    id: "mod-ngram",
    group: "Analysis modules",
    title: "N-grams",
    keywords: "ngram bigram trigram sequence",
    body: (
      <>
        <P>
          Recurring word sequences. Bigrams (two consecutive words) and
          trigrams (three) attested at least twice. Often surfaces
          formulaic phrasing — useful for libation tablets and accounting
          headers.
        </P>
      </>
    ),
  },
  {
    id: "mod-arith",
    group: "Analysis modules",
    title: "Accounting & Metrology",
    keywords:
      "arithmetic kuro kiro po-to-ku-ro total grand total deficit accounting numerals fractions metrology balance",
    body: (
      <>
        <P>
          Linear A accounting tablets list entries — a term or personal
          name, sometimes a commodity ideogram, and a quantity — and often
          close with <code>KU-RO</code> ("total") or{" "}
          <code>PO-TO-KU-RO</code> ("grand total"). This module reads the
          actual numbers (decimal integers plus the metrological fractions
          ½, ¾, ¹⁄₁₆ …), sums each tablet's line items, and{" "}
          <b>checks the sum against the stated total</b>.
        </P>
        <H3>What the columns mean</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>balances</b> (green) — the line items sum exactly to the
            stated <code>KU-RO</code> / <code>PO-TO-KU-RO</code>.
          </li>
          <li>
            <b>discrepant</b> (amber) — they don't. Click the row to see the
            itemized arithmetic and the size of the gap.
          </li>
        </ul>
        <H3>Reading the discrepancies</H3>
        <P>
          Discrepancies are the interesting part. Some are scribal errors
          (genuinely present in the originals), some come from damaged or
          restored readings, and some reflect open questions about the
          fraction system. For example <code>HT 9b</code> balances exactly
          (3+3+8+2+2+2+4 = 24) while <code>HT 9a</code> is off by ¾.
        </P>
        <H3><code>KI-RO</code> deficits</H3>
        <P>
          <code>KI-RO</code> ("deficit / owed") lines are shown in the
          itemized view but excluded from the total sum, since they record
          what's outstanding rather than what's counted.
        </P>
        <Note>
          Section boundaries are heuristic — the running item sum resets at
          each total line. Tablets with interleaved sub-totals or
          multi-column layouts may not parse perfectly; the itemized view
          lets you check the parse by eye. Export all checks as CSV from the
          toolbar.
        </Note>
      </>
    ),
  },
  {
    id: "mod-signs",
    group: "Analysis modules",
    title: "Sign Concordance",
    keywords: "sign concordance position initial medial final",
    body: (
      <>
        <P>
          Every sign with its attestation count broken down by position
          (initial, medial, final) within multi-sign words. Strong
          positional bias often correlates with grammatical role — e.g.
          inflectional suffixes appear almost exclusively in final position.
        </P>
      </>
    ),
  },
  {
    id: "mod-kwic",
    group: "Analysis modules",
    title: "Concordance (KWIC)",
    keywords: "concordance kwic keyword context dispersion window",
    body: (
      <>
        <P>
          Keyword-in-context view — the corpus-linguistics standard for
          inspecting how a target word is actually used. Every attestation
          gets its own row showing surrounding context tokens, with the
          keyword aligned in a center column.
        </P>
        <H3>Target word</H3>
        <P>
          Enter the GORILA transliteration (e.g. <code>KU-RO</code>,{" "}
          <code>JA-SA-SA-RA-ME</code>) or click one of the quick-pick
          buttons to start with a high-frequency word.
        </P>
        <H3>Window size</H3>
        <P>
          How many tokens of left and right context to show per row.
          Default 4 each side; raise or lower as you need.
        </P>
        <H3>Sort modes</H3>
        <P>
          Click any column header. The convention in corpus linguistics:
        </P>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>Left context</b> — sorts by the immediate-left token first.
            Identical neighbors cluster together so you can see if your
            keyword is consistently preceded by a particular word.
          </li>
          <li>
            <b>Right context</b> — same, but immediately to the right.
          </li>
          <li>
            <b>Source</b> — by corpus order. The default.
          </li>
        </ul>
        <H3>Site and period filters</H3>
        <P>
          Narrow attestations to a specific findspot or LM/MM dating
          period. Useful for checking whether usage shifts over time or
          regionally.
        </P>
        <H3>Dispersion bar</H3>
        <P>
          The thin bar above the table shows where in the corpus the
          keyword is attested — each vertical tick is one attestation,
          positioned along the corpus order. Tight clusters suggest the
          word is concentrated at certain sites or tablet groups; even
          spread suggests broad use.
        </P>
        <Tip>
          The annotation, pin, and collection actions all work normally
          on the keyword and context tokens. Pin a word here, then visit{" "}
          <ModuleLink to="cooc">Co-occurrence</ModuleLink> to see its
          statistical collocations.
        </Tip>
      </>
    ),
  },
  {
    id: "mod-signtrans",
    group: "Analysis modules",
    title: "Sign Transitions",
    keywords:
      "sign transitions graphotactics bigram matrix heatmap follows precedes adjacency constraints",
    body: (
      <>
        <P>
          Graphotactic analysis — which signs follow which within multi-sign
          words. This surfaces the script's structural constraints: signs
          that strongly prefer certain neighbors, signs restricted to word
          edges, and the large number of sign pairs that <em>never</em>{" "}
          occur adjacently (the "matrix density" stat shows how sparse the
          transition space is).
        </P>
        <H3>Heatmap</H3>
        <P>
          A grid of the most frequent signs, row → column = "row-sign
          followed by column-sign." Darker cells are more frequent
          transitions (log-scaled); blank cells are pairs that never occur.
          Click a row label or cell to inspect that sign.
        </P>
        <H3>Sign inspector</H3>
        <P>
          Pick any sign to see what it <b>precedes</b> (outgoing
          transitions) and what it <b>follows</b> (incoming), each ranked
          and weighted by word frequency, plus how often the sign appears
          word-initial vs word-final. Hover a transition for example words.
        </P>
        <H3>Conditional probability</H3>
        <P>
          Tick <b>conditional probability</b> to switch from raw transition
          counts to <em>P(next │ current)</em>: each heatmap row is normalized
          to its own outgoing total (so the colors show how a sign distributes
          its successors), and the inspector lists show each partner's share as
          a percentage. This is what tells you whether a sign almost always
          takes one particular follower versus spreading evenly.
        </P>
        <Note>
          Transitions are weighted by word attestation count, so a frequent
          word contributes proportionally more to the observed structure.
          This is graphotactics (sign sequence), not phonotactics — the
          sound values of many signs are unknown.
        </Note>
      </>
    ),
  },
  {
    id: "mod-signref",
    group: "Analysis modules",
    title: "Sign Inventory",
    keywords: "sign inventory glyph unicode linear b gorila",
    body: (
      <>
        <P>
          Every sign attested in the corpus with its Unicode glyph (rendered
          in Noto Sans Linear A), GORILA label, Linear B value when shared,
          attestation count, and example words containing it.
        </P>
        <H3>Filter tabs</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>AB-shared</b> — signs with Linear B equivalents (about 60% of
            the corpus by attestation). These have known phonetic values.
          </li>
          <li>
            <b>Linear A only</b> — signs marked with <code>*</code> in
            GORILA (e.g. <code>*301</code>). Unique to Linear A; phonetic
            value unknown.
          </li>
          <li>
            <b>Unknown</b> — sign variants without an assigned phonetic
            value (e.g. subscript variants like <code>RA2</code>).
          </li>
        </ul>
        <Note>
          The "confidence" column measures how often this sign's modal glyph
          appears in clean corpus alignments — a sanity check on the
          empirically-derived sign↔glyph mapping.
        </Note>
        <H3>↗ SigLA per-scribe variants</H3>
        <P>
          Every row carries an <Btn>↗ SigLA</Btn> button that opens the
          canonical paleographic database{" "}
          <a href="https://sigla.phis.me/" target="_blank" rel="noreferrer">
            sigla.phis.me
          </a>{" "}
          and (on modern browsers) scrolls directly to that sign in their
          sign list. SigLA shows you the per-scribe variant drawings — how
          each hand actually drew the sign on the tablets — which is the
          paleographic side this workbench deliberately doesn't try to
          duplicate. The workbench uses idealized Unicode glyphs for
          legibility; SigLA owns the per-hand <em>ductus</em> analysis.
          Use both.
        </P>
        <P>
          The same <Btn>↗ SigLA</Btn> button is on every row in{" "}
          <ModuleLink to="signs">Sign Concordance</ModuleLink> too. At the
          inscription level, every tablet's detail modal has a{" "}
          <Btn>Paleography ↗</Btn> button that opens SigLA's page for that
          specific document.
        </P>
      </>
    ),
  },

  {
    id: "mod-comp",
    group: "Interpretation modules",
    title: "Cross-Linguistic comparator",
    keywords: "cross linguistic compare akkadian hittite alignment matrix",
    body: (
      <>
        <P>
          Compares Linear A phonetic readings against nine reference
          languages: Mycenaean Greek (Linear B), Akkadian, Hittite, Luwian,
          Hurrian, Ugaritic, Pre-Greek substrate, Proto-Indo-European,
          Egyptian. Two views:
        </P>
        <Tip>
          <b>Mycenaean Greek (Linear B)</b> is the best-calibrated
          comparison: the workbench reads Linear A <em>using Linear B sign
          values</em>, so both sides of a Mycenaean match share the same
          syllabary's sounds — apples to apples, unlike the other languages
          where the phonetic systems differ. (The historical result is that
          Linear A is mostly <em>not</em> Greek — but specific names and
          administrative terms do align, and this is where you'd see it.)
        </Tip>
        <H3>Ranked matches</H3>
        <P>
          Start typing a Linear A word — the box autocompletes from the
          corpus vocabulary (ranked by frequency), so you don't have to
          reproduce the exact transliteration with its subscripts and
          asterisks. Pick a word to get all reference-language entries
          within a distance threshold, ranked by score. Distance uses
          weighted Levenshtein — vowel ↔ vowel costs 0.3, same-class
          consonants 0.5, far substitutions 1.0 by default.
        </P>
        <H3>Tuning sliders</H3>
        <P>
          The <b>Tuning</b> row lets you adjust those costs live — make vowel
          shifts cheap if you suspect the script under-differentiates vowels,
          raise the same-class cost to demand tighter consonant agreement, or
          widen the <b>threshold</b> to admit looser matches. Both the ranked
          list and the alignment matrix re-rank as you drag; <b>Reset</b>{" "}
          restores the defaults.
        </P>
        <H3>Phonetic scheme (which phonemes count as "near")</H3>
        <P>
          The weights set <em>how cheap</em> a near-miss is; the{" "}
          <b>Phonetic scheme</b> panel sets <em>which</em> substitutions count
          as near in the first place. A handful of cross-language sound
          correspondences are genuine linguistic judgment calls, so they're
          yours to make: whether the interdentals <code>ṯ ḏ</code> (θ/ð) group
          with the dental stops or the sibilants, whether the pharyngeal{" "}
          <code>ḥ</code> counts as a back consonant near the velars, whether
          the voiced postalveolar <code>ž</code> joins the sibilants, and
          whether reconstruction/notation marks (<code>* ₁₂₃ ʷ ʰ ◌̥</code>)
          are stripped from reference forms before comparing. The{" "}
          <b>Extended (default)</b> preset gives each ambiguous phoneme
          near-miss credit with its nearest articulatory neighbor;{" "}
          <b>Conservative</b> grants no near-miss credit beyond the core
          classes. Changing the scheme re-ranks live, and the active scheme
          is stamped into any finding or report you save from here, so a
          match ranking stays reproducible.
        </P>
        <P>
          Found a match worth keeping? Hit <b>✎ Use</b> on any row (ranked,
          matrix, or bulk) to record that meaning as a proposed-meaning
          annotation on the Linear A word — confidence is set from the match
          score and the source language/word/score is cited in the note. It
          then flows into <ModuleLink to="annot">My Research</ModuleLink> and
          the research report like any other hypothesis.
        </P>
        <H3>Alignment matrix</H3>
        <P>
          Enter a Linear A word, see the <em>best</em> match in each
          reference language side-by-side, with phoneme-by-phoneme color
          coding: green = exact, amber = vowel shift, purple = same-class
          consonant, red = far substitution, blue = insertion, gray =
          deletion. This is the comparative-method view.
        </P>
        <H3>Bulk mode</H3>
        <P>
          "Bulk (top 50)" picks the 50 most-attested Linear A words and
          finds each one's best cross-linguistic match. Good for high-level
          sanity checks.
        </P>
        <H3>Sortable results</H3>
        <P>
          Every column in the matrix, ranked, and bulk tables sorts on click
          (click again to reverse). Score sorts by best-first by default;
          word / language / meaning / domain / phonetic sort alphabetically.
        </P>
        <H3>Read this before trusting a match</H3>
        <P>
          The module's intro callout carries a load-bearing caveat that's
          worth re-reading: Linear A is undeciphered, sign phonetic values
          follow the Linear B convention (a working assumption, not a fact),
          and the bundled wordlists are short editorial samples without
          specialist peer review. Treat ranked matches as exploratory leads
          against a noisy null model. The{" "}
          <ModuleLink to="methodology" intent={{ focus: "cross-linguistic-distance" }}>
            Methodology page
          </ModuleLink>{" "}
          has the full math and limitations.
        </P>
        <Note>
          Wordlists are short and editorial. Custom wordlists can be added
          via the <ModuleLink to="wlm">Wordlist Manager</ModuleLink>.
        </Note>
      </>
    ),
  },
  {
    id: "mod-hyp",
    group: "Interpretation modules",
    title: "Sound Shift",
    keywords:
      "sound shift phoneme override hypothesis workspace save compare snapshot diff",
    body: (
      <>
        <P>
          Two tabs over the same shared <em>hypothesis</em> state — the per-sign
          phonetic overrides that propagate to every word reading in the
          workbench. <b>Editor</b> is the live workbench; <b>Workspace</b> is
          the snapshot library.
        </P>
        <H3>Editor</H3>
        <P>
          Test alternative phonetic readings. The grid lists every AB-shared
          sign with its standard Linear B value editable. Change <code>KU</code>{" "}
          to <code>gu</code>, <code>QE</code> to <code>kwi</code>, etc., and
          watch what happens to cross-linguistic matches and word readings
          across the workbench. Below the grid, a free-text field for each
          modified sign lets you capture <em>why</em> you proposed this reading
          (saved as part of the snapshot).
        </P>
        <H3>Match delta — did it help?</H3>
        <P>
          Once you've modified at least one sign, a summary appears in the
          Editor: for the top words, the closest reference-language match under
          the <em>standard</em> reading vs your <em>modified</em> reading, with
          a <b>Δ</b> column (green = the change moves the word closer to a
          known word, red = further). The stat boxes roll this up into average
          match before/after, a net points change, and an improved/worsened
          count — a quick objective check on whether a proposed sound shift
          actually improves alignment or just changes it.
        </P>
        <H3>Save & reload</H3>
        <P>
          Name and <b>Save snapshot</b> from the Editor toolbar; saved snapshots
          appear as a strip you can click to reload or delete in place. No tab
          switch needed for routine save/reload.
        </P>
        <H3>Workspace</H3>
        <P>
          The richer comparison view: <b>Compare all</b> lays out every saved
          snapshot side-by-side and shows the closest match for the top 10
          corpus words under each one. <b>Diff two</b> gives a focused pairwise
          comparison — pick snapshot A and snapshot B, see exactly which signs
          they assign differently (e.g. <code>RO</code> <code>ro → rû</code>),
          plus for the top words each one's best-match score under A vs B with
          a green/red <b>Δ</b>. The cleaner way to answer "is B actually better
          than A?" when you have several snapshots in play.
        </P>
        <H3>Apply</H3>
        <P>
          Changes propagate immediately. Visit any other module to see the
          effect of the currently-loaded hypothesis.
        </P>
      </>
    ),
  },
  {
    id: "mod-sem",
    group: "Interpretation modules",
    title: "Semantic Classifier",
    keywords:
      "semantic ideogram domain oil grain field classify hypothesis annotate proposed meaning worksheet",
    body: (
      <>
        <P>
          Groups multi-sign words by their co-occurring ideograms (commodity
          signs like <code>GRA</code> = grain, <code>OLE</code> = oil,{" "}
          <code>VIN</code> = wine). Words frequently appearing next to{" "}
          <code>GRA</code> are likely to be grain-related terms — quantities,
          varieties, transactions, owners. These groupings are{" "}
          <em>attested</em> — read straight off the tablets.
        </P>
        <P>
          <strong>Build your own classification.</strong> The attested groups
          are a starting point; the interpretation is yours. Create a{" "}
          <em>semantic field</em> (e.g. "personnel", "grain terms"), make it
          active, then click <span className="mono">＋</span> beside any word to
          sort it into that field. The active field's words are listed right in
          the worksheet — review and prune your grouping in place. Click{" "}
          <span className="mono">✎</span> beside
          a word to record a proposed meaning and confidence without leaving the
          module. Fields are saved as{" "}
          <ModuleLink to="collections">Collections</ModuleLink> and your
          proposed meanings as annotations, so both flow straight into your{" "}
          <ModuleLink to="report">Research Report</ModuleLink>.
        </P>
        <P>
          The <span className="mono">✎</span> control is the same{" "}
          <b>inline word tools</b> popover that appears on every word across the
          workbench (when enabled in Display settings): annotate, add to a
          collection, or pin — wherever you see a word. And from any word's
          detail view, <b>Open in →</b> jumps to that word in the Concordance,
          Cross-Linguistic, or Co-occurrence module.
        </P>
        <P>
          For the commodities themselves — their quantities, ligature
          variants, and distribution — see the{" "}
          <ModuleLink to="commodities">Commodity Catalog</ModuleLink>.
        </P>
      </>
    ),
  },
  {
    id: "mod-commodities",
    group: "Interpretation modules",
    title: "Commodity Catalog",
    keywords:
      "commodity ideogram logogram grain oil wine figs cyperus livestock GRA OLE VIN NI quantity ligature",
    body: (
      <>
        <P>
          A catalog of the commodity logograms (ideograms) the accounts
          record: grain (<code>GRA</code>), olive oil (<code>OLE</code>),
          wine (<code>VIN</code>), figs (<code>NI</code>/<code>FIC</code>),
          cyperus (<code>CYP</code>), livestock, people, and materials —
          with their standard scholarly glosses, ligature variants
          (<code>OLE+U</code>, <code>GRA+PA</code>), recorded quantities,
          and distribution.
        </P>
        <H3>What you can see per commodity</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>Occurrences</b> and <b>summed quantity</b> (from numbers on
            the same line as the logogram)
          </li>
          <li><b>Ligature variants</b> and how often each appears</li>
          <li>
            <b>Co-occurring transaction terms</b> — the words/names that
            share a line with the commodity (candidate quantities, owners,
            transaction types)
          </li>
          <li><b>Sites</b> and tablet counts</li>
        </ul>
        <H3>Undeciphered logograms</H3>
        <P>
          The <code>*NNN</code> signs used logographically whose referent
          is unknown are listed separately. <code>*301</code> is by far the
          most frequent logogram in the whole corpus — an open question.
        </P>
        <Note>
          Summed quantities are a <em>lower bound</em>: when a commodity
          heads a column of otherwise-unlabeled quantities (named once in a
          tablet header), those quantities aren't attributed to it. Glosses
          are the standard scholarly readings, not certainties.
        </Note>
      </>
    ),
  },
  {
    id: "mod-signpat",
    group: "Analysis modules",
    title: "Sign Patterns",
    keywords:
      "sign pattern wildcard glob graphotactic search prefix suffix middle template shape skeleton query",
    body: (
      <>
        <P>
          Wildcard graphotactic search over the corpus. Type a sign sequence
          using two wildcards and the module surfaces every word that
          matches the shape, plus its attestation count.
        </P>
        <H3>Syntax</H3>
        <P>
          Patterns are sign sequences with two wildcard tokens:
        </P>
        <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <code>*</code> — matches <em>exactly one</em> sign of any
            identity. <code>KU-*-RO</code> finds three-sign words that start
            with <code>KU</code> and end with <code>RO</code>.
          </li>
          <li>
            <code>**</code> — matches <em>zero or more</em> signs.{" "}
            <code>JA-**</code> finds every word starting with{" "}
            <code>JA</code> (any length). <code>**-RO-**</code> finds every
            word containing <code>RO</code> anywhere.
          </li>
          <li>
            Plain sign labels match themselves: <code>A-SA-SA-RA-ME</code>{" "}
            is a literal lookup, no wildcards.
          </li>
        </ul>
        <H3>What it's for</H3>
        <P>
          Asking shape questions. Is <code>*-RO</code> (anything-ro) a
          productive ending? Which two-sign words appear that start with{" "}
          <code>A</code>? Does any word contain the sequence{" "}
          <code>SA-RA</code> regardless of position? The module is the
          fastest way to answer those without writing code.
        </P>
        <H3>Where else the engine lives</H3>
        <P>
          The same wildcard matcher is wired into{" "}
          <ModuleLink to="query">Query Builder</ModuleLink> as the{" "}
          <code>word contains pattern</code> field, so a graphotactic shape
          can be combined with site / period / scribe / suffix filters in
          one compound query.
        </P>
        <Note>
          Sign labels are normalized to the workbench's canonical form
          (<code>RA₂</code> → <code>RA2</code>) on both sides of the match.
          See <HelpLink to="mod-signref">Sign Inventory</HelpLink> for the
          label set you can use in patterns.
        </Note>
      </>
    ),
  },
  {
    id: "mod-pos",
    group: "Interpretation modules",
    title: "Positional Grammar",
    keywords: "positional grammar initial medial final word position",
    body: (
      <>
        <P>
          For every word attested ≥3 times: where it tends to sit within an
          inscription (initial / medial / final). Strong positional
          preference is a marker of grammatical function — verbs, particles,
          definite suffixes often occupy specific slots.
        </P>
      </>
    ),
  },
  {
    id: "mod-struct",
    group: "Interpretation modules",
    title: "Tablet Structure",
    keywords: "tablet structure classification accounting libation",
    body: (
      <>
        <P>
          Heuristic classification of every inscription into accounting,
          libation, list, free text, or unclassified. Useful for slicing the
          corpus by type before running other analyses (e.g. "show me the
          word-frequency distribution of libation tablets only").
        </P>
        <P>
          <b>The heuristic is a starting point, not a verdict.</b> Disagree with
          a call? Use the dropdown on any tablet's row to re-classify it — the
          tablet moves to your chosen category, the counts update, a{" "}
          <span className="mono">✎</span> marks it as moved, and your override
          persists and appears under "Reclassified tablets" in your{" "}
          <ModuleLink to="annot">research report</ModuleLink>. To undo a single
          change, click the <Btn>↺ Revert</Btn> button that appears on any
          reclassified row (or pick the "(auto)" option in its dropdown). To
          undo them all at once, <Btn>↺ Reset all reclassifications</Btn> next
          to the "{`{n}`} reclassified by you" count reverts every tablet back
          to its automatic category.
        </P>
      </>
    ),
  },
  {
    id: "mod-lib",
    group: "Interpretation modules",
    title: "Libation Formulas",
    keywords: "libation formula peak sanctuary religious",
    body: (
      <>
        <P>
          Linear A libation tables found at peak sanctuaries (like Mount
          Iuktas, Symi) carry a recurring formulaic text. This module lists
          inscriptions containing known formula words like{" "}
          <code>JA-SA-SA-RA-ME</code> (proposed: deity epithet) and shows
          their structural alignment.
        </P>
      </>
    ),
  },
  {
    id: "mod-stems",
    group: "Interpretation modules",
    title: "Stem Families",
    keywords:
      "stem families lemma lemmatization morphology cluster suffix productive",
    body: (
      <>
        <P>
          Heuristic morphological clustering — groups multi-sign words that
          appear to share a stem and differ only by a <em>productive</em>{" "}
          suffix. The algorithm reports candidate "stem families" for
          inspection; because Linear A is undeciphered, these are not
          lemmas in the strict sense.
        </P>
        <H3>How it works</H3>
        <ol
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            Tally every suffix that ends at least <b>N distinct words</b>{" "}
            in the corpus — these are "productive" suffixes.
          </li>
          <li>
            For each word <code>W</code>, if <code>W</code> equals{" "}
            <code>stem + productive-suffix</code> and <code>stem</code> is
            itself attested as a corpus word, link the two via Union-Find.
          </li>
          <li>
            Connected components of those links are reported as stem
            families. The shortest member is treated as the candidate
            stem; longer members are candidate inflected forms.
          </li>
        </ol>
        <H3>Controls</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>min suffix productivity</b> — raise to be stricter about
            what counts as a productive suffix (fewer but cleaner
            families). Default 5.
          </li>
          <li>
            <b>min family size</b> — minimum members to report a family.
          </li>
          <li>
            <b>max suffix length</b> — in signs. Higher allows longer
            multi-sign suffixes (e.g. <code>-RA-NA</code>).
          </li>
        </ul>
        <P>
          Click any family row to expand its member forms with their
          suffix differences and attestation counts. Compare with{" "}
          <ModuleLink to="roots">Root Cognates</ModuleLink> (consonant
          skeleton — fuzzier, no suffix model) and{" "}
          <ModuleLink to="morph">Morphology</ModuleLink> (raw suffix /
          prefix counts).
        </P>
        <Note>
          A productive suffix here just means "ends many distinct words" —
          it might be inflectional, derivational, phonological, or
          incidental. We don't have the grammar to know which.
        </Note>
      </>
    ),
  },
  {
    id: "mod-minpairs",
    group: "Interpretation modules",
    title: "Minimal Pairs",
    keywords:
      "minimal pairs alternation substitution inflection sign value contrast",
    body: (
      <>
        <P>
          Two words of the same length differing in exactly one sign
          position form a minimal pair (<code>KU-RO</code> /{" "}
          <code>KU-RE</code>). The module aggregates the recurring{" "}
          <em>alternations</em> — which sign substitutes for which, and in
          what position — ranked by how many word pairs exhibit them.
        </P>
        <H3>Why it matters</H3>
        <P>
          A sign pair that alternates productively in word-<b>final</b>{" "}
          position is a strong candidate for an inflectional ending; medial
          alternations may signal phonological variation or scribal
          variants. Minimal pairs are also a classic lever for hypothesizing
          sign values — if two signs alternate in otherwise identical
          environments, they may be phonetically related.
        </P>
        <H3>Controls</H3>
        <P>
          Filter by position (initial / medial / final), filter by a
          specific sign, and click any alternation row to expand the full
          list of word pairs. Export all pairs as CSV.
        </P>
        <P>
          Compare with <ModuleLink to="stems">Stem Families</ModuleLink>{" "}
          (shared stem + productive suffix) and{" "}
          <ModuleLink to="roots">Root Cognates</ModuleLink> (shared
          consonant skeleton) — minimal pairs are the most local of the
          three, looking at single-sign contrasts anywhere in the word.
        </P>
      </>
    ),
  },
  {
    id: "mod-onomastics",
    group: "Interpretation modules",
    title: "Name Candidates",
    keywords:
      "onomastics names personal name toponym entry counted distribution candidate",
    body: (
      <>
        <P>
          A distributional heuristic for spotting candidate personal names.
          On the accounting tablets, a name behaves like a <em>counted
          entry</em>: it heads its line (line-initial), the line carries a
          quantity, and the word tends to be local to one or two sites. This
          module scores every multi-sign word on those signals and ranks the
          candidates.
        </P>
        <H3>The columns</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>Entry rate</b> — fraction of the word's counted-line
            occurrences where it is line-initial (heads the entry).
          </li>
          <li>
            <b>Sites</b> — fewer is more name-like (names tend to be local).
          </li>
          <li>
            <b>Initial</b> — line-initial occurrences / counted-line
            occurrences.
          </li>
          <li>
            <b>Score</b> — composite of entry rate, position-before-number,
            and locality.
          </li>
        </ul>
        <P>
          Sort by any column; filter to local words (≤2 sites) or by a
          minimum number of counted lines. Known transaction terms
          (<code>KU-RO</code>, <code>KI-RO</code>, <code>PO-TO-KU-RO</code>)
          are excluded.
        </P>
        <H3>Build a vetted list</H3>
        <P>
          The heuristic only proposes — you decide. <b>Accept</b> (✓) or{" "}
          <b>dismiss</b> (✕) each candidate to sort it into a curated list.
          Accepted words go to a "Personal names (accepted)" collection and
          dismissed ones to "Name candidates (dismissed)", so both appear in
          the <ModuleLink to="collections">Collections</ModuleLink> module and
          your <ModuleLink to="report">Research Report</ModuleLink>. Use the
          Undecided / Accepted / Dismissed filter to work through the list; the
          CSV export records your verdict per row.
        </P>
        <Note>
          A heuristic, not a determination: high-scoring words pattern like
          counted entries, which makes them candidates for personal names —
          but also possibly place names, titles, or commodity terms. Use the
          features to judge each case, and cross-check in{" "}
          <ModuleLink to="kwic">Concordance</ModuleLink>.
        </Note>
      </>
    ),
  },
  {
    id: "mod-roots",
    group: "Interpretation modules",
    title: "Root Cognates",
    keywords: "root cognate consonant skeleton family",
    body: (
      <>
        <P>
          Strips vowels from every word's phonetic reading to extract its
          consonant skeleton, then groups words sharing the same skeleton.
          These root families are candidates for morphological relatives —
          e.g. noun and its inflected forms, or a verb stem and its derived
          forms.
        </P>
      </>
    ),
  },

  {
    id: "mod-seqpat",
    group: "Pattern modules",
    title: "Sequence Patterns",
    keywords: "sequence pattern token template",
    body: (
      <>
        <P>
          Tokenizes each inscription into a sequence of structural types:{" "}
          <code>W</code> word, <code>N</code> number, <code>T</code> total
          marker, <code>I</code> ideogram, <code>S</code> separator. Then
          surfaces every sub-sequence of length 2–6 attested at least 3
          times. Lets you see formulaic templates without committing to
          specific words.
        </P>
      </>
    ),
  },
  {
    id: "mod-geo",
    group: "Pattern modules",
    title: "Site Distribution",
    keywords: "geography site jaccard exclusive",
    body: (
      <>
        <P>
          The <b>Site distribution</b> tab of the{" "}
          <ModuleLink to="map">Geography</ModuleLink> module — its other tab is
          the interactive findspot Map. Three sub-views by tab here:
        </P>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>Sites</b> — inscription count per site, with unique vocabulary
            counts
          </li>
          <li>
            <b>Jaccard similarity</b> — pairwise lexical overlap between the
            top sites. Crete's main centers (Haghia Triada, Knossos, Zakros)
            share more vocabulary than peripheral sites.
          </li>
          <li>
            <b>Site-exclusive words</b> — words attested ≥2 times but only
            at one site. Useful for finding place-specific vocabulary
            (names, local products, sanctuary terms).
          </li>
        </ul>
        <H3>Word overlay (Map tab)</H3>
        <P>
          On the <b>Map</b> tab, type a word into <b>Overlay</b> to recolor the
          map by where that word is attested: matching sites light up in cyan
          (brighter = more tablets), every other site dims out, and the marker
          counts switch to that word's per-site tally. A fast way to see a
          term's geographic footprint — e.g. <code>KU-RO</code> clusters almost
          entirely at the Haghia Triada accounting archive.
        </P>
        <H3>Save snapshot to findings</H3>
        <P>
          The Map's <Btn>💾 Save to findings</Btn> button captures a PNG
          snapshot of the map exactly as you see it — current zoom, focused
          site, and any active word overlay — and attaches it to the finding.
          The snapshot shows in the Findings list and is rendered inline in the{" "}
          <ModuleLink to="report">research report</ModuleLink> exports (HTML
          and ZIP), so the report includes the visual, not just the site
          codes.
        </P>
      </>
    ),
  },
  {
    id: "mod-scribes",
    group: "Pattern modules",
    title: "Scribe Comparison",
    keywords: "scribe comparison paleography sigla jaccard sign frequency",
    body: (
      <>
        <P>
          The <b>Comparison</b> tab of the{" "}
          <ModuleLink to="scribes">Scribes</ModuleLink> module — its other tab
          is the scribal <b>Network</b> graph.
        </P>
        <P>
          A quantitative proxy for paleography: for each of the 102
          attested scribes, profile their sign-usage frequencies and
          compare two scribes side-by-side. Different sign-frequency
          distributions suggest different scribal training or
          specialization.
        </P>
        <H3>How to use</H3>
        <ol
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            Pick a scribe from the dropdown (or click one of the
            quick-pick buttons in the empty state). Stats and sign
            profile appear.
          </li>
          <li>
            Optionally pick a second scribe to compare against. Without
            one, the comparison is against the corpus-wide baseline of
            all scribed inscriptions combined — or choose{" "}
            <b>(vs. this scribe's site average)</b> to compare against
            everyone who wrote at the same site. The site baseline controls
            for regional vocabulary, so the "distinctive" signs that survive
            reflect the individual hand rather than just where they worked.
          </li>
          <li>
            Two charts: <b>Most distinctive signs</b> (sorted by absolute
            log-ratio — signs the primary scribe uses much more or much
            less than the comparison) and <b>Top signs by raw count</b>{" "}
            (the scribe's workhorse signs regardless of comparison).
          </li>
        </ol>
        <H3>Vocabulary overlap (Jaccard)</H3>
        <P>
          When two scribes are selected, the toolbar shows the Jaccard
          similarity over their distinct sign vocabularies — intersection
          / union of the sets of signs each used at least once. A high
          Jaccard means the two scribes drew on the same sign repertoire;
          a low Jaccard means their sign vocabularies barely overlap,
          suggesting they may have specialized in different tablet
          types or topics.
        </P>
        <H3>For real paleography, use SigLA</H3>
        <P>
          This module compares sign <em>frequency</em>, not sign{" "}
          <em>shape</em>. For per-scribe variant drawings — i.e. how each
          scribe physically rendered the sign KA — open any inscription's
          detail modal and click <Btn>Paleography ↗</Btn> to jump to that
          tablet's SigLA record.
        </P>
        <Note>
          Sign-frequency similarity is necessary but not sufficient
          evidence for scribal identity or training: two scribes might
          share a vocabulary because they wrote about the same subjects.
          Cross-reference with site, period, and tablet type.
        </Note>
      </>
    ),
  },
  {
    id: "mod-scribenet",
    group: "Pattern modules",
    title: "Scribal Network",
    keywords:
      "scribal network jaccard force-directed graph scribe similarity",
    body: (
      <>
        <P>
          The <b>Network</b> tab of the{" "}
          <ModuleLink to="scribes">Scribes</ModuleLink> module.
        </P>
        <P>
          Force-directed graph view of the scribes themselves: nodes are
          scribes (sized by inscription count, colored by primary
          find-site), edges connect scribes whose sign vocabularies overlap
          above a Jaccard threshold. Clusters that emerge tend to reflect
          shared training, shared workshop, or shared tablet-type
          specialization.
        </P>
        <H3>Controls</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>min inscriptions</b> — drop scribes with fewer attestations
            than this (small-sample profiles are too noisy to network)
          </li>
          <li>
            <b>min Jaccard</b> — edges below this threshold aren't drawn
            (lower = more edges, denser graph)
          </li>
        </ul>
        <H3>Interaction</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>Drag</b> a node to reposition it (released nodes settle
            back into the simulation)
          </li>
          <li>
            <b>Click</b> a node to focus its neighborhood (other nodes dim)
          </li>
          <li>
            <b>Double-click</b> a node to open it in{" "}
            <ModuleLink to="scribes">Scribe Comparison</ModuleLink> with
            the scribe pre-selected
          </li>
        </ul>
        <Note>
          High vocabulary overlap between two scribes is necessary but not
          sufficient evidence for shared training — they might share a
          vocabulary because they wrote about the same subjects. The
          single-pair view in{" "}
          <ModuleLink to="scribes">Scribe Comparison</ModuleLink> shows
          the distinctive-signs breakdown for closer inspection.
        </Note>
      </>
    ),
  },
  {
    id: "mod-diachronic",
    group: "Pattern modules",
    title: "Diachronic (MM / LM)",
    keywords:
      "diachronic middle late minoan period phase change vocabulary over time historical",
    body: (
      <>
        <P>
          Compares the corpus across dating phases, surfacing the words and
          signs most distinctive to each by a log-ratio of relative frequency
          (add-one smoothed). Toggle between <b>Words</b> and <b>Signs</b>.
        </P>
        <H3>Pick any two phases</H3>
        <P>
          The two <b>Compare</b> selectors default to the broad{" "}
          <b>Middle Minoan</b> vs <b>Late Minoan</b> buckets, but you can pick
          any specific sub-phase instead — e.g. <code>LM IA</code> vs{" "}
          <code>LM IB</code>, or <code>MM II</code> vs <code>MM III</code> — to
          look at finer-grained change. The counts and distinctive lists relabel
          to whichever two phases you chose.
        </P>
        <H3>Read the caveat</H3>
        <P>
          The default MM-vs-LM sample is heavily lopsided: the LM phase
          (dominated by Late Minoan IB Haghia Triada) has well over a thousand
          tablets, while MM has only a few dozen — so the smaller side's
          "distinctive" results rest on few attestations. The module flags this
          whenever the two phases you've chosen are badly imbalanced. Treat such
          results as suggestive leads, not settled diachronic facts. Undated
          tablets are excluded.
        </P>
        <P>
          For synchronic geographic variation instead of temporal, see{" "}
          <ModuleLink to="geo">Site Distribution</ModuleLink>.
        </P>
      </>
    ),
  },
  {
    id: "mod-network",
    group: "Pattern modules",
    title: "Co-occurrence Network",
    keywords: "network graph force directed pmi",
    body: (
      <>
        <P>
          The <b>Network graph</b> tab of{" "}
          <ModuleLink to="cooc">Co-occurrence</ModuleLink>.
        </P>
        <P>
          Force-directed graph of word co-occurrence by PMI. Nodes are
          words, edges connect words that co-occur more than chance.
        </P>
        <H3>Interact</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>
            <b>Drag</b> any node to reposition it. Released nodes settle
            back into the simulation.
          </li>
          <li>
            <b>Click</b> a node to focus on its neighborhood (other nodes
            dim).
          </li>
          <li>
            <b>Double-click</b> a node to open its word detail modal.
          </li>
          <li>
            <b>Top-N edges</b> slider controls how many word pairs to
            include — higher pulls in more vocabulary, lower keeps the
            highest-PMI structure.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "mod-notes",
    group: "Research modules",
    title: "Notes",
    keywords:
      "notes markdown free-form connective tissue reference link cross-reference wiki",
    body: (
      <>
        <P>
          The <b>Notes</b> tab of{" "}
          <ModuleLink to="annot">My Research</ModuleLink> is free-form
          Markdown — the long-form thinking that ties the structured items
          together. Each note has a title and a body; you can have as many as
          you want, listed in the left pane.
        </P>
        <H3>References (the workbench-aware part)</H3>
        <P>
          The <Btn>+ Reference</Btn> button opens a typeahead that searches{" "}
          <em>everything</em> in the workbench — every inscription, word, sign,
          annotation, collection, finding, or other note. Picking one inserts a
          Markdown link with a <code>wb:</code>-scheme URL at your cursor.
          References render as color-coded chips in the live preview and in the
          report export; clicking a chip in the preview opens the right thing
          (inscription/word in the detail modal; annotation/collection/finding
          jumps to that tab; another note opens here).
        </P>
        <H3>Include a note in the report</H3>
        <P>
          The <ModuleLink to="report">research report</ModuleLink> builder has
          a <b>+ Note block</b> that lets you drop any of your notes into the
          report as its own section — references rendered as the same chips,
          flowing into the Markdown and HTML/ZIP exports alongside the
          auto-generated sections and your text/image blocks. Write the prose
          here; assemble it there.
        </P>
        <H3>Hover &amp; backlinks</H3>
        <P>
          Hover any chip in the preview for a quick peek (~300 ms delay) — a
          kind-specific card with the inscription's glyphs &amp; metadata,
          word's phonetic &amp; counts, finding's summary, etc. Click goes
          straight to the source; hover keeps you in your train of thought.
          Each note also shows a <b>Referenced by</b> footer listing every
          other note that links to it, so you can navigate the wiki in both
          directions.
        </P>
        <Tip>
          Notes use a small Markdown subset: <code>#</code> .. <code>######</code>{" "}
          headings, blank-line paragraphs, <code>**bold**</code>,{" "}
          <code>*italic*</code>, <code>`code`</code>, <code>- bullet</code> or{" "}
          <code>1.</code> numbered lists, and <code>{">"} blockquote</code>{" "}
          lines. Hover previews respect the <b>Hover previews</b> Display
          setting.
        </Tip>
      </>
    ),
  },
  {
    id: "mod-annot",
    group: "Research modules",
    title: "Annotations",
    keywords: "annotation module list manage",
    body: (
      <>
        <P>
          The <b>Annotations</b> tab of{" "}
          <ModuleLink to="annot">My Research</ModuleLink> (alongside Collections
          and the Research report).
        </P>
        <P>
          Lists every annotation you've made. Filterable by kind, searchable
          by content. <Btn>Open</Btn> jumps back to the target;{" "}
          <Btn>Export JSON</Btn> / <Btn>Import</Btn> for sharing and backup.
          See <HelpLink to="annotations">Annotations basics</HelpLink> above for
          how to create them, or jump to the live{" "}
          <ModuleLink to="annot">My Research</ModuleLink> hub.
        </P>
      </>
    ),
  },
  {
    id: "mod-collections",
    group: "Research modules",
    title: "Collections",
    keywords: "collections module bookmark group",
    body: (
      <>
        <P>
          The <b>Collections</b> tab of{" "}
          <ModuleLink to="collections">My Research</ModuleLink>.
        </P>
        <P>
          Manage your named bookmark sets. See{" "}
          <HelpLink to="collections">Collections basics</HelpLink> above, or
          open the <ModuleLink to="collections">live hub</ModuleLink>.
        </P>
        <H3>Set operations</H3>
        <P>
          With two or more collections, the <b>Set operation</b> row builds a
          new collection from two existing ones: <b>∪ union</b> (items in
          either), <b>∩ intersect</b> (items in both), or <b>− difference</b>{" "}
          (in A but not B). Handy for questions like "words tagged as names{" "}
          <em>and</em> attested at Zakros" or "candidate religious terms minus
          the ones I've already explained". The result is a normal collection,
          so it exports and can scope the workbench like any other.
        </P>
      </>
    ),
  },
  {
    id: "mod-query",
    group: "Research modules",
    title: "Query Builder",
    keywords: "query builder filter compound saved",
    body: (
      <>
        <P>
          Stackable compound filters across the corpus. Combine
          inscription-level criteria (site, scribe, period, support, has
          facsimile, has annotation) with word-level criteria (prefix,
          suffix, syllable count, contains sign, co-occurs with).
        </P>
        <H3>and / or / not</H3>
        <P>
          Each row after the first carries an <b>and</b> / <b>or</b> connector,
          and any row can be negated with <b>not</b>. Rows are combined
          left-to-right <em>within their group</em> — inscription-level rows
          evaluate together, word-level rows evaluate together — so "ends with{" "}
          <code>-SI</code> <b>or</b> ends with <code>-TI</code>" widens the set,
          while "<b>not</b> site is Haghia Triada" excludes it. (For a flat
          AND-only query, just leave every connector on <b>and</b>.)
        </P>
        <H3>Output modes</H3>
        <P>
          Switch between matching <b>inscriptions</b> (default) and matching{" "}
          <b>words</b>. In word mode, word-level filters select the words
          themselves; inscription-level filters constrain to words appearing
          in matching tablets.
        </P>
        <H3>Save queries</H3>
        <P>
          Name and save a query, recall it any time. Stored in
          localStorage. Saved queries are also what the diff dropdown reads
          from.
        </P>
        <H3>Do something with the result</H3>
        <P>
          Above the result table, the action toolbar lets you act on the
          current result set:
        </P>
        <ul>
          <li>
            <Btn>◇ Use as scope</Btn> — materializes the matching
            inscriptions as a new collection and points the global Scope at
            it. Every other module (KWIC, Co-occurrence, Sign Transitions…)
            then computes against just those inscriptions. Inscription mode
            only.
          </li>
          <li>
            <Btn>+ Save as collection</Btn> — keeps the result set as a
            named collection of inscriptions or words for later reuse from
            the Collections module.
          </li>
          <li>
            <Btn>💾 Save to findings</Btn> — captures the table itself into
            your findings (the full result list, not just a one-liner). The
            research report renders it inline.
          </li>
        </ul>
        <H3>Per-row pivots</H3>
        <P>
          The rightmost column on every row hands the result off to another
          module:
        </P>
        <ul>
          <li>
            On an inscription row: <Btn>Compare</Btn>,{" "}
            <Btn>Browse</Btn>, <Btn>Structure</Btn>.
          </li>
          <li>
            On a word row: <Btn>KWIC</Btn>, <Btn>Cooc</Btn>,{" "}
            <Btn>Cross-Ling</Btn> — opens that module with the word as the
            focus.
          </li>
        </ul>
        <H3>Diff two queries</H3>
        <P>
          Use <b>diff against</b> (next to the saved-query list) to pick a
          target. A tab strip appears: <b>Only in current</b>, <b>In both</b>,
          and <b>Only in “other”</b>. Useful for asking "what tablets
          changed between MM and LM that match the same word pattern", or
          "which collocates of A are not collocates of B." Both queries must
          share the same output mode (inscriptions vs. words).
        </P>
        <Tip>
          Example query: "all words ending in <code>-SI</code> appearing in
          libation tablets from MM IIIA". Add three filter rows: "Word ends
          with: SI" + "Has facsimile: yes" + "Period is: MMIIIA", set
          output to Words.
        </Tip>
      </>
    ),
  },
  {
    id: "mod-compare",
    group: "Research modules",
    title: "Compare Inscriptions",
    keywords: "compare side by side parallel alignment findings save export",
    body: (
      <>
        <P>
          Place up to four inscriptions side-by-side. Multi-sign words
          attested in two or more of them are highlighted in matching colors
          across columns — making formulaic structure visible at a glance.
          Pick inscriptions by typing IDs in the picker.
        </P>
        <H3>Interlinear vs Columns</H3>
        <P>
          The <b>Interlinear</b> view runs a word-level alignment
          (Needleman–Wunsch, extended progressively for 3–4 tablets) so that
          shared words land in the <em>same row</em> across columns, with gaps
          (<b>·</b>) where a tablet has no match — the classic parallel-text
          layout that makes a shared formulaic backbone, and each tablet's
          departures from it, obvious. A shaded row marks where the same word
          aligns. <b>Columns</b> is the plain side-by-side text. Each column
          header carries the tablet's site, period, and scribe.
        </P>
        <H3>Highlight shared signs</H3>
        <P>
          Tick <b>highlight shared signs</b> to tint individual signs that are
          attested in two or more of the compared tablets — useful for spotting
          shared sign-level material inside words that aren't themselves
          identical.
        </P>
        <P>
          <b>Keep what you build.</b> With two or more selected,{" "}
          <Btn>Export CSV</Btn> dumps the comparison, and{" "}
          <Btn>💾 Save to findings</Btn> stores it as a named, reloadable
          result. Saved comparisons appear right below the picker —{" "}
          <Btn>Load</Btn> restores one — and they flow into your{" "}
          <HelpLink to="mod-findings">Findings</HelpLink> list and the research
          report.
        </P>
      </>
    ),
  },
  {
    id: "mod-findings",
    group: "Research modules",
    title: "Findings",
    keywords:
      "findings saved results export track comparison query report snapshot",
    body: (
      <>
        <P>
          A <b>finding</b> is any analysis result you choose to keep. Click{" "}
          <Btn>💾 Save to findings</Btn> to capture the current result with an
          editable title and an optional note. Look for the button next to a
          module's <Btn>Export CSV</Btn> — it's available across the analysis
          modules (Compare Inscriptions, Word Frequency, Co-occurrence,
          Concordance, Minimal Pairs, Scribe Comparison, and many more).
        </P>
        <P>
          Findings are tracked in <b>My Research › Findings</b>: review them,
          jump back to the module that produced each, delete them, or export the
          whole set as JSON or Markdown. They're also compiled into your{" "}
          <ModuleLink to="report">research report</ModuleLink>. Unlike an
          inline word annotation, a finding captures a whole <em>result</em> —
          the thing you assembled, not a note on a single word.
        </P>
      </>
    ),
  },

  {
    id: "mod-export",
    group: "Research modules",
    title: "Data Export",
    keywords:
      "export csv json data backup restore wipe reset cache lost recover transfer machine",
    body: (
      <>
        <P>
          Export analysis tables as CSV or JSON for use in spreadsheets,
          notebooks, or statistical tools. Available: word frequencies,
          comparison results, full inscriptions, sign concordance. The
          comparison export uses your current hypothesis. (Many individual
          modules also have their own Export CSV button.)
        </P>
        <H3>📦 Full corpus JSON</H3>
        <P>
          For downstream work in Python / R / jq, the <b>Full corpus JSON</b>{" "}
          card at the top of the module emits a single structured file with
          all 1,721 inscriptions (or your scoped slice) in one shot. Every
          canonical field from the upstream transcription is preserved
          (site, period, scribe, support, findspot, words, lines, glyphs,
          translations, image paths and rights), plus a per-inscription{" "}
          <code>derived</code> block with the workbench's enriched analyses:
          multi-sign-word count, tablet-structure category (heuristic + any
          override you applied), and the accounting balance check where
          applicable.
        </P>
        <P>
          Versioned schema (currently v1), full provenance and the
          methodology URL in <code>_meta</code>. Optional toggles include
          the 84-sign inventory, the multi-sign word frequency table, and
          your own annotations / collection memberships / pin state.{" "}
          <b>Scope is respected</b> — set a Scope in the top bar first to
          export just one site, period, or collection.
        </P>
        <P>
          The same schema is available per-inscription via the{" "}
          <Btn>JSON ↓</Btn> button in any inscription's detail modal — useful
          for emailing one tablet's full record to a colleague, or for a
          quick sanity check before exporting the bulk.
        </P>
        <Tip>
          The corpus JSON is the right starting point if you want to run
          your own analyses in pandas / R / sklearn. <code>jq</code> from
          the command line is a fast way to slice it without loading
          Python — e.g.{" "}
          <code>
            jq '.inscriptions[] | select(.derived.balance.allBalance == false)'
          </code>{" "}
          lists every discrepant accounting tablet.
        </Tip>
        <H3>Backup &amp; restore your work</H3>
        <P>
          Everything you create — annotations, collections, findings, saved
          hypotheses, queries, pinned items, tablet reclassifications, your
          report layout, sidebar layout, and display settings — lives in this
          browser's storage. Clearing the cache, switching to a different
          machine, or losing the device wipes it. The <Btn>⬇ Download backup</Btn>{" "}
          button writes a single timestamped JSON file containing all of it;{" "}
          <Btn>⬆ Restore from file…</Btn> reads one back. Restore offers two
          modes: <b>Merge</b> overwrites only the keys present in the backup
          (safe — anything you've added since is left alone), <b>Replace
          everything</b> wipes current state first (a true round-trip).
        </P>
        <Tip>
          Get into the habit of downloading a backup at the end of each
          session, and after any notable batch of work. The file is plain JSON,
          so it can also be hand-edited or moved between machines.
        </Tip>
        <H3>Folder sync — auto-backup to a folder</H3>
        <P>
          On Chromium browsers (Chrome, Edge) a <b>Folder sync</b> card lets
          you skip the manual download habit. <Btn>🗂 Connect a folder…</Btn>{" "}
          once, and the workbench writes the same all-in-one backup JSON into
          that folder — on demand with <Btn>⬇ Back up now</Btn>, or
          automatically every 5 / 15 / 30 minutes (and only when your work has
          actually changed). <Btn>⬆ Restore from folder</Btn> reads it back
          through the same merge/replace preview.
        </P>
        <P>
          The trick: point it at your <b>Google Drive, Dropbox, or OneDrive
          desktop-sync folder</b>. The workbench writes the file locally and
          your cloud provider's own desktop app uploads and version-histories
          it — so you get off-machine cloud backup with no sign-in, no
          account, and nothing leaving your control beyond what your cloud
          client already syncs.
        </P>
        <Note>
          The folder connection lives in this browser. After a reload you may
          need to click <Btn>🔓 Reconnect folder</Btn> once to re-authorize
          access (a browser security requirement). Auto-backup only runs while
          the workbench tab is open. On Firefox / Safari the card explains the
          feature isn't available and points you back to manual backup.
        </Note>
        <H3>Reset to baseline — start over</H3>
        <P>
          A <b>Reset to baseline</b> card wipes <em>all</em> of your
          workbench data and returns to a clean install — annotations,
          collections, findings, saved hypotheses, queries, pinned items,
          tablet reclassifications, notes, report &amp; sidebar layout, and
          display settings. It's deliberately hard to trigger by accident:{" "}
          <Btn>Reset everything…</Btn> reveals a confirmation where you must
          type <code>CLEAR</code> before the erase button activates. The
          action can't be undone, so download a backup first if there's any
          chance you'll want the work back. A connected sync folder stays
          paired.
        </P>
      </>
    ),
  },
  {
    id: "mod-report",
    group: "Research modules",
    title: "Research Report",
    keywords:
      "report markdown publication export annotations hypotheses collections citations",
    body: (
      <>
        <P>
          The <b>Research report</b> tab of{" "}
          <ModuleLink to="annot">My Research</ModuleLink>.
        </P>
        <P>
          Compiles everything you've created — annotations (grouped by
          confidence), saved sound-shift hypotheses with their per-sign
          reasoning, and collections — into a single formatted Markdown
          report, with the standard corpus and scholarship citations
          appended.
        </P>
        <H3>Arrange the layout</H3>
        <P>
          The report auto-compiles from your work, but the <b>Report layout</b>{" "}
          editor lets you shape it: each section (annotations, hypotheses,
          collections, findings, reclassifications) is a row you can move{" "}
          <b>▲ / ▼</b> or toggle off, and you can drop in your own <b>Text
          block</b> (heading + paragraphs) and <b>Image block</b> (pick a
          tablet by ID) anywhere in the order. Set a cover title, subtitle, and
          author up top. Your layout is saved between visits; <b>Reset layout</b>{" "}
          restores the defaults.
        </P>
        <H3>Collections become tablet sheets</H3>
        <P>
          The Collections section no longer lists bare IDs: each inscription you
          collected expands into a full sheet — site, period, scribe, support,
          token count, the rendered Linear A <b>glyphs</b>, the complete
          transliteration, and editorial glosses (the same information you see
          when you click the tablet in the workbench). The HTML export embeds
          the Linear A font so the glyphs render even offline.
          Word entries show their phonetic reading and attestation count. The{" "}
          <b>collection tablets</b> selector chooses which plate to embed —
          facsimile (default), photograph, both, or none.
        </P>
        <H3>Markdown or HTML</H3>
        <P>
          <Btn>Copy</Btn> / <Btn>Download .md</Btn> give you Markdown — pastes
          into GitHub, converts to LaTeX/Word via Pandoc, plain-text diffable.{" "}
          <Btn>Download .html</Btn> gives a styled, self-contained HTML document
          that opens in any browser and prints straight to PDF — with the tablet
          plates and the Linear A font <em>base64-embedded</em>, so it stays a
          single shareable file that renders offline. <Btn>Download .zip</Btn>{" "}
          packages the same report with the images stored as separate files in
          an <code>images/</code> folder instead of inline — noticeably smaller
          for image-heavy reports; just unzip and open <code>report.html</code>.
        </P>
        <H3>The HTML report is interactive</H3>
        <P>
          The exported HTML isn't a static page. A sticky toolbar at the top
          carries a filter input, a collapse-all toggle, and a light/dark
          theme switch; below it sits a chip-row table of contents that
          auto-builds from your section headings and scroll-spies the
          currently-visible section. Everything works fully offline — no
          server, no dependencies, single file:
        </P>
        <ul>
          <li>
            <b>Filter</b> — type to hide any finding whose title, summary,
            module, or notes don't match. Press <code>/</code> from anywhere
            to focus the filter, <kbd>Esc</kbd> to clear.
          </li>
          <li>
            <b>Sortable tables</b> — click any column header in any captured
            result table to sort by it; click again to reverse. Numeric
            columns sort numerically, text columns alphabetically.
          </li>
          <li>
            <b>Click a word or sign chip</b> (any <code>KU-RO</code>-style
            code chip in the report) to highlight every other occurrence of
            the same token across the whole document. Click again to clear.
          </li>
          <li>
            <b>Collapse</b> any section by clicking its heading; the chevron
            tracks state. The toolbar button collapses or expands all at
            once.
          </li>
          <li>
            <b>Dark mode</b> persists in localStorage, so the reader's
            preference sticks across re-opens.
          </li>
          <li>
            Print stays clean — the toolbar, TOC, and collapsed-state
            disappear, and every section expands for the print version.
          </li>
        </ul>
        <P>
          This is the bridge from exploration to a paper draft: do your
          analysis across the modules, record findings as{" "}
          <ModuleLink to="annot">annotations</ModuleLink> and{" "}
          <ModuleLink to="hypws">hypotheses</ModuleLink>, then generate the
          report.
        </P>
      </>
    ),
  },
  {
    id: "mod-wlm",
    group: "Research modules",
    title: "Wordlist Manager",
    keywords: "wordlist custom comparison language upload",
    body: (
      <>
        <P>
          Manage built-in and custom comparison wordlists. Upload your own
          reference vocabulary as JSON (array of <code>{"{w, m, d}"}</code>{" "}
          objects) or CSV (one <code>word,meaning,domain</code> per line).
          Uploaded lists immediately become selectable in the
          Cross-Linguistic comparator.
        </P>
      </>
    ),
  },
  {
    id: "mod-lexicon",
    group: "Research modules",
    title: "My Lexicon",
    keywords: "lexicon glossary meanings annotations dictionary vocabulary",
    body: (
      <>
        <P>
          Every annotation you make — via the quiet ✎ control next to any
          word, or from a word/tablet detail view — lands here as a row in
          one working glossary: the proposed meaning, your confidence,
          evidence links, and notes, joined live with how widely the form is
          attested in the corpus (count and site spread). Filter by text,
          kind, or minimum confidence; sort by any column; export CSV or
          save the table to{" "}
          <ModuleLink to="annot" intent={{ tab: "findings" }}>findings</ModuleLink>{" "}
          for the report.
        </P>
        <P>
          The point is leverage: you annotate one word at a time, and the
          lexicon assembles the dictionary-in-progress for free. It's also
          the quickest audit of your own evidence — a "high confidence"
          entry with one attestation and no evidence links stands out.
        </P>
      </>
    ),
  },

  // ─────────────────────────── WORKFLOWS ──────────────────────────────
  {
    id: "wf-case",
    group: "Workflow recipes",
    title: "Recipe: building a case for a word's meaning",
    keywords: "workflow recipe meaning evidence annotate argue case",
    body: (
      <ol
        style={{
          fontFamily: "var(--serif)",
          fontSize: 14,
          lineHeight: 1.8,
          color: "var(--text-dim)",
          paddingLeft: 20,
        }}
      >
        <li>
          <ModuleLink to="kwic">Concordance (KWIC)</ModuleLink> → read every
          context the word appears in; note line positions
        </li>
        <li>
          <ModuleLink to="comp">Cross-Linguistic</ModuleLink> → check the
          alignment matrix for plausible sound-alike candidates
        </li>
        <li>
          <ModuleLink to="cooc">Co-occurrence</ModuleLink> → what company
          does it keep? Commodity logograms and totals are strong context
          clues
        </li>
        <li>
          Open the word's detail and <b>✎ annotate</b> it — proposed
          meaning, confidence, and the evidence in the notes field
        </li>
        <li>
          <ModuleLink to="annot" intent={{ tab: "notes" }}>Notes</ModuleLink>{" "}
          → write the argument up properly, inserting <Btn>+ Reference</Btn>{" "}
          chips for the word, the key tablets, and your annotation
        </li>
        <li>
          Compile the report (My Research → Report) — your annotation,
          note, and findings arrive with citations attached
        </li>
      </ol>
    ),
  },
  {
    id: "wf-copy",
    group: "Workflow recipes",
    title: "Recipe: is this tablet a copy of another?",
    keywords: "workflow recipe duplicate copy similar parallel fragment",
    body: (
      <ol
        style={{
          fontFamily: "var(--serif)",
          fontSize: 14,
          lineHeight: 1.8,
          color: "var(--text-dim)",
          paddingLeft: 20,
        }}
      >
        <li>
          <ModuleLink to="similarity">Similarity</ModuleLink> →{" "}
          <Btn>Find similar</Btn> with your tablet as the pivot
        </li>
        <li>
          Take the top matches to{" "}
          <ModuleLink to="compare">Compare Inscriptions</ModuleLink> and
          switch on the <b>interlinear</b> view — shared words align
          row-by-row
        </li>
        <li>
          Toggle <b>shared-sign highlight</b> to confirm overlapping
          vocabulary rather than coincidence
        </li>
        <li>
          <Btn>Save to findings</Btn> so the comparison is captured with
          its table
        </li>
        <li>
          Open each tablet's detail and read the inline <b>commentary</b> —
          the scholarship may already link them
        </li>
      </ol>
    ),
  },
  {
    id: "wf-explore",
    group: "Workflow recipes",
    title: "Recipe: exploring a single word",
    keywords: "workflow recipe explore single word",
    body: (
      <ol
        style={{
          fontFamily: "var(--serif)",
          fontSize: 14,
          lineHeight: 1.8,
          color: "var(--text-dim)",
          paddingLeft: 20,
        }}
      >
        <li>
          <ModuleLink to="search">Corpus Search</ModuleLink> → type the word, click it to open detail
        </li>
        <li>
          Pin it (<Btn>☆ Pin</Btn>) so it stays in the right rail
        </li>
        <li>
          <ModuleLink to="comp">Cross-Linguistic</ModuleLink> → enter the word, switch to{" "}
          <Btn>Alignment matrix</Btn>
        </li>
        <li>
          <ModuleLink to="cooc">Co-occurrence</ModuleLink> → search for the word in pairs (PMI mode)
        </li>
        <li>
          <b>Positional Grammar</b> → find the word's row to see if it
          biases initial/final
        </li>
        <li>
          Back to detail modal → write an annotation with your hypothesis
        </li>
      </ol>
    ),
  },
  {
    id: "wf-formula",
    group: "Workflow recipes",
    title: "Recipe: finding a formula",
    keywords: "workflow recipe formula libation pattern",
    body: (
      <ol
        style={{
          fontFamily: "var(--serif)",
          fontSize: 14,
          lineHeight: 1.8,
          color: "var(--text-dim)",
          paddingLeft: 20,
        }}
      >
        <li>
          <ModuleLink to="ngram" intent={{ tab: "tri" }}>N-grams</ModuleLink> → look at frequent trigrams
        </li>
        <li>
          <ModuleLink to="seqpat">Sequence Patterns</ModuleLink> → find structural templates
        </li>
        <li>
          Pick 3–4 inscriptions sharing a pattern and open{" "}
          <ModuleLink to="compare">Compare Inscriptions</ModuleLink>
        </li>
        <li>
          Visual confirmation — shared words highlighted, formula obvious
        </li>
        <li>
          Save the matching tablets to a <ModuleLink to="collections">Collection</ModuleLink> for later
        </li>
      </ol>
    ),
  },
  {
    id: "wf-soundshift",
    group: "Workflow recipes",
    title: "Recipe: testing a sound-shift hypothesis",
    keywords: "workflow sound shift hypothesis",
    body: (
      <ol
        style={{
          fontFamily: "var(--serif)",
          fontSize: 14,
          lineHeight: 1.8,
          color: "var(--text-dim)",
          paddingLeft: 20,
        }}
      >
        <li>
          Save a "baseline" hypothesis in <ModuleLink to="hypws">Sound Shift › Workspace</ModuleLink> with
          no overrides
        </li>
        <li>
          Open <ModuleLink to="hyp">Sound Shift</ModuleLink>, edit some sign readings, fill in your
          reasoning per sign
        </li>
        <li>
          Visit <ModuleLink to="comp">Cross-Linguistic</ModuleLink> and click <Btn>Bulk (top 50)</Btn> — does it improve match scores?
        </li>
        <li>
          Save the modified hypothesis with a descriptive name
        </li>
        <li>
          Use <Btn>Compare all</Btn> in <ModuleLink to="hypws">Sound Shift › Workspace</ModuleLink> to see them
          side-by-side
        </li>
      </ol>
    ),
  },

  // ─────────────────────────── PERSISTENCE ────────────────────────────
  {
    id: "persistence",
    group: "Reference",
    title: "Data & persistence",
    keywords: "data persistence storage localstorage corpus",
    body: (
      <>
        <H3>What's bundled in the app</H3>
        <P>
          The corpus itself (1,721 tagged entries spanning roughly 1,400–
          1,500 documents — see <ModuleLink to="methodology">Methodology</ModuleLink>{" "}
          for the count distinction — 84 unique syllabic signs, all
          metadata) ships with the workbench as static JSON.
        </P>
        <P>
          Commentary HTML, facsimile images, and GORILA PDFs are resolved
          through a configurable <code>ASSET_BASE</code> path. By default
          this points at <code>public/upstream/</code> — drop the{" "}
          <code>commentary/</code>, <code>images/</code>, and{" "}
          <code>papers/</code> folders from mwenge/lineara.xyz there (or run{" "}
          <code>npm run assets:fetch</code>) for a fully offline experience.
          If the folder is empty, images and commentary will show as broken
          until you populate it or point <code>ASSET_BASE</code> at the
          upstream CDN.
        </P>
        <H3>What's saved in your browser</H3>
        <ul
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text-dim)",
            paddingLeft: 20,
          }}
        >
          <li>Annotations</li>
          <li>Collections (bookmarks of inscriptions and words)</li>
          <li>Findings (saved analysis results with captured tables)</li>
          <li>Notes (free-form Markdown with cross-references)</li>
          <li>Saved queries</li>
          <li>Saved hypotheses (including per-sign reasoning)</li>
          <li>Tablet category overrides</li>
          <li>Research-report layout (block order, text/image/note blocks)</li>
          <li>Sidebar collapsed-group state</li>
          <li>Pin rail state and width</li>
          <li>Display settings</li>
        </ul>
        <P>
          All under <code>localStorage</code> keys prefixed with{" "}
          <code>linear-a-workbench:</code>. The <b>single best safeguard</b>{" "}
          is the <ModuleLink to="export">Data Export</ModuleLink> module's{" "}
          <b>Backup &amp; restore</b> section — one JSON file containing
          everything, restorable on this or another machine. The Annotations
          and Collections modules also expose per-category JSON export/import
          for narrower transfers.
        </P>
        <Note>
          Clearing your browser's storage (or using incognito) will wipe
          everything. Download a backup at the end of each session.
        </Note>
        <H3>Refreshing the corpus</H3>
        <P>
          The corpus is regenerated from the upstream repo via{" "}
          <code>npm run corpus:fetch</code>. The build script aligns
          transliterations with glyph strings codepoint-by-codepoint to
          empirically derive the sign↔Unicode mapping.
        </P>
      </>
    ),
  },
  {
    id: "health",
    group: "Reference",
    title: "Corpus Health",
    keywords:
      "health dashboard coverage completeness metadata quality damage uncertain missing scribe period image translation classified",
    body: (
      <>
        <P>
          <ModuleLink to="health">Corpus Health</ModuleLink> reports the
          dataset's own condition: how many inscriptions carry a scribal
          hand, a dating period, a findspot, images, editorial glosses, and
          an automatic document classification — plus the share of tablets
          with damage/uncertainty marks in their transcription. Always
          corpus-wide, ignoring the Scope.
        </P>
        <H3>Why it matters</H3>
        <P>
          Every analysis inherits these limits: a scribe comparison only
          sees the ~third of tablets with an attributed hand, and a
          diachronic claim only the dated share. Check here first, then
          read other modules' results against what's actually covered. Each
          coverage row clicks through to the module that uses that
          metadata, and the per-site table exports as CSV.
        </P>
        <Tip>
          Low coverage at a site usually reflects that site's publication
          record, not a data-loading gap — GORILA's metadata varies by
          site and volume.
        </Tip>
      </>
    ),
  },
  {
    id: "methodology-page",
    group: "Reference",
    title: "Methodology page",
    keywords:
      "methodology math algorithms statistics formulas citations references pmi g2 chi-squared jaccard levenshtein fisher bonferroni wilson zipf phonetic distance",
    body: (
      <>
        <P>
          The full technical documentation lives at{" "}
          <ModuleLink to="methodology">Help → Methodology</ModuleLink> — same
          file as <code>docs/METHODOLOGY.md</code> on GitHub, rendered inline
          with a sticky filterable table of contents, scroll-spy, smooth
          in-doc anchor jumps, and source-code links that point at the
          relevant files on github.com.
        </P>
        <H3>What's in it</H3>
        <P>
          Sections covering the math behind every analysis: corpus
          normalization, the empirical sign→Unicode glyph derivation,
          weighted Levenshtein for cross-linguistic comparison, PMI / G² /
          Yates-corrected χ² / Wilson-score intervals / Fisher's exact in the
          co-occurrence module, the scribal-network Jaccard, progressive
          multiple-sequence alignment for the interlinear view, heuristic
          stem-family clustering, consonant-skeleton roots, the
          KU-RO / PO-TO-KU-RO balance check, lexical statistics (Zipf,
          type-token, hapax spectrum), graphotactics, per-scribe sign-
          frequency profiles, comparison wordlist provenance, and known
          limitations.
        </P>
        <H3>Cite either</H3>
        <P>
          The in-app page and the GitHub copy are the same canonical
          document — cite whichever URL is more useful in your context. The
          in-app reading experience adds navigation and lets you jump to a
          section directly from any module that uses it (e.g. the
          Cross-Linguistic module's "Read this before trusting a match"
          callout deep-links straight to the Cross-linguistic distance
          section).
        </P>
      </>
    ),
  },
  {
    id: "credits",
    group: "Reference",
    title: "Credits & sources",
    keywords: "credits sources gorila mwenge younger",
    body: (
      <>
        <H3>Corpus data</H3>
        <P>
          Inscription data — transliterations, glyph strings, translations,
          scribe and findspot metadata, and facsimile image references —
          comes from the{" "}
          <a
            href="https://github.com/mwenge/lineara.xyz"
            target="_blank"
            rel="noreferrer"
          >
            mwenge/lineara.xyz
          </a>{" "}
          repository. That project transcribed and structured the corpus
          from the <b>GORILA</b> ("Recueil des inscriptions en linéaire A")
          publications by Louis Godart and Jean-Pierre Olivier (École
          Française d'Athènes, 1976–1985). All five GORILA volumes are
          digitized in open access in the EfA's CEFAEL library —{" "}
          <a href={GORILA_CEFAEL_URL} target="_blank" rel="noreferrer">
            read the edition of record there
          </a>
          .
        </P>
        <P>
          I use the data with full credit. Their site at{" "}
          <a href="https://lineara.xyz" target="_blank" rel="noreferrer">
            lineara.xyz
          </a>{" "}
          is a complementary tool — image-first browsing with John Younger's
          scholarly commentary and a geographic map of findspots. If you
          want to <em>see</em> the tablets rather than analyze them
          computationally, go there.
        </P>
        <H3>Working in Python</H3>
        <P>
          If you'd rather script your analysis, I also maintain{" "}
          <a
            href="https://github.com/ryanpavlicek/pyaegean"
            target="_blank"
            rel="noreferrer"
          >
            pyaegean
          </a>{" "}
          (<code>pip install pyaegean</code>). It ports this workbench's
          Linear A analysis — sign-pattern search, phonetic distance and
          alignment, collocation statistics, the query engine — tested
          against the same expected values, and adds scriptable corpus
          access, pandas DataFrames, Ancient Greek NLP, and
          citation/provenance output for papers. The two tools stay on the
          same data; the Query Builder and each tablet's detail view can
          copy ready-to-run pyaegean code.
        </P>
        <H3>Facsimile and photograph images</H3>
        <P>
          © École Française d'Athènes. Loaded on demand from the upstream
          repository's image folder for reference only. Image rights pointers
          link back to the original GORILA volume PDFs where possible.
        </P>
        <H3>Scholarly commentary</H3>
        <P>
          John Younger maintains the standard online Linear A reference. He
          moved off the KU secondary server in 2024 and reorganized the
          material as PDFs on academia.edu:{" "}
          <a
            href="https://www.academia.edu/117949722/Younger_JG_Linear_A_folder_introduction"
            target="_blank"
            rel="noreferrer"
          >
            academia.edu/Younger_JG_Linear_A_folder
          </a>
          {" "}— that's where to look for the most current readings.
        </P>
        <P>
          The workbench ships with a bundled mirror of his pre-2024 KU-era
          commentary (via lineara.xyz), rendered inline in every inscription
          detail modal with GORILA volume references, scribe identification,
          Schoep tablet typology, and line-by-line readings. The inline
          panel carries an explicit "pre-2024 snapshot" note and a link to
          the academia.edu folder so a careful reader knows what they're
          looking at and can get to the current version with one click.
        </P>
        <H3>Sign Unicode</H3>
        <P>
          Linear A occupies Unicode code points U+10600–U+1077F (Linear A
          block). Glyphs are rendered via the freely-available{" "}
          <a
            href="https://fonts.google.com/noto/specimen/Noto+Sans+Linear+A"
            target="_blank"
            rel="noreferrer"
          >
            Noto Sans Linear A
          </a>{" "}
          font.
        </P>
        <H3>Comparison wordlists</H3>
        <P>
          Editorial sets compiled from standard reference works on Mycenaean
          Greek (Linear B), Akkadian, Hittite, Luwian, Hurrian, Ugaritic,
          Pre-Greek substrate, Proto-Indo-European, and Egyptian. Not
          authoritative; treat them as starting points, and upload your own
          via the <b>Wordlist Manager</b>.
        </P>
        <P>
          This workbench is for research and exploration. Decipherment
          remains an open problem.
        </P>
      </>
    ),
  },
];

export const GROUPS = [
  "Orientation",
  "Basics",
  "Analysis modules",
  "Interpretation modules",
  "Pattern modules",
  "Research modules",
  "Tools",
  "Workflow recipes",
  "Reference",
];
