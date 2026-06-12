import { useState } from "react";
import { useWorkbench } from "../store/workbench";
import { downloadFile } from "../lib/helpers";
import { isFolderSyncSupported } from "../lib/folderSync";
import {
  buildResearchBundle,
  buildVault,
  type VaultInput,
} from "../lib/vaultExport";

// Take your research out of the browser and into your notes app: a full
// Obsidian vault written straight to a folder (Chromium's File System
// Access API), or one self-contained Markdown document for NotebookLM or
// any other tool that takes a text source.
export function VaultExportCard() {
  const notes = useWorkbench((s) => s.notes);
  const annotations = useWorkbench((s) => s.annotations);
  const collections = useWorkbench((s) => s.collections);
  const findings = useWorkbench((s) => s.findings);
  const corpus = useWorkbench((s) => s.corpus);
  const toast = useWorkbench((s) => s.toast_show);
  const [writing, setWriting] = useState(false);

  const itemCount =
    notes.length + annotations.length + collections.length + findings.length;

  function vaultInput(): VaultInput {
    return {
      generatedAt: new Date().toISOString(),
      notes,
      annotations,
      collections,
      findings,
      getInscription: (id) => corpus.byId.get(id),
      getWordStat: (w) => {
        const d = corpus.wordIndex.get(w);
        return d ? { count: d.count, sites: [...d.sites].sort() } : undefined;
      },
    };
  }

  async function exportVault() {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: (opts?: {
          id?: string;
          mode?: "read" | "readwrite";
        }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) return;
    let root: FileSystemDirectoryHandle;
    try {
      root = await picker({ id: "linear-a-vault", mode: "readwrite" });
    } catch {
      return; // user dismissed the picker
    }
    setWriting(true);
    try {
      const files = buildVault(vaultInput());
      for (const f of files) {
        const parts = f.path.split("/");
        let dir = root;
        for (const part of parts.slice(0, -1)) {
          dir = await dir.getDirectoryHandle(part, { create: true });
        }
        const fh = await dir.getFileHandle(parts[parts.length - 1], {
          create: true,
        });
        const w = await fh.createWritable();
        await w.write(f.content);
        await w.close();
      }
      toast(`Vault written — ${files.length} files`);
    } catch (err) {
      console.warn("vault export failed:", err);
      toast("Couldn't write the vault to that folder.", "error");
    } finally {
      setWriting(false);
    }
  }

  function downloadBundle() {
    downloadFile(
      "linear-a-research-bundle.md",
      buildResearchBundle(vaultInput()),
      "text/markdown",
    );
    toast("Research bundle downloaded");
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h4>Take your research to your notes app</h4>
      <p className="sub" style={{ marginTop: 4 }}>
        <b>Obsidian vault</b>: pick a folder and the workbench writes your
        notes, lexicon, collections, and findings as linked Markdown pages —
        workbench cross-references become wikilinks, and every tablet or word
        your research touches gets a stub page that links back here. Re-export
        any time; only the generated files are overwritten.{" "}
        <b>Research bundle</b>: the same content as a single Markdown document
        with live links — made for NotebookLM or anything else that takes a
        text source. Both are one-way snapshots; the workbench remains the
        place you work.
      </p>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {isFolderSyncSupported() ? (
          <button
            className="btn btn-sm"
            onClick={exportVault}
            disabled={writing || itemCount === 0}
            title="Write an Obsidian vault into a folder you pick"
          >
            {writing ? "Writing…" : "⬇ Export Obsidian vault…"}
          </button>
        ) : (
          <span className="dim" style={{ fontSize: 12, alignSelf: "center" }}>
            Folder export needs a Chromium browser (Chrome / Edge / Brave) —
            the bundle below works everywhere.
          </span>
        )}
        <button
          className="btn btn-outline btn-sm"
          onClick={downloadBundle}
          disabled={itemCount === 0}
          title="Download one Markdown file with all your research"
        >
          ⬇ Download research bundle (.md)
        </button>
      </div>
      {itemCount === 0 && (
        <p className="sub dim" style={{ marginTop: 8, fontSize: 12 }}>
          Nothing to export yet — annotate a word, save a finding, or write a
          note first.
        </p>
      )}
    </div>
  );
}
