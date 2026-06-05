import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import SoundShift from "./SoundShift";
import HypothesisWorkspace from "./HypothesisWorkspace";

// Consolidated wrapper: the live sound-shift editor (per-sign overrides + match
// deltas) and the saved-hypothesis workspace (snapshot manager + pairwise diff)
// both operate on the same `hypothesis` state — folding them into one module
// with tabs keeps the workflow continuous (tweak in Editor, snapshot it in
// Workspace, compare snapshots, jump back to Editor). The legacy `hypws` id is
// kept routable so existing deep-links / Help references open the Workspace tab.
export default function SoundShiftTabs() {
  // Subscribe (don't just snapshot via getState) so a same-component
  // navigation like the Editor's "Compare all →" button — which calls
  // setActiveModule("hypws") while we're already mounted as `hyp` — actually
  // remounts us and re-picks `initialKey`. Without this, useState in
  // TabbedModule retains the original tab and the click looks broken.
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const initialKey =
    activeModule === "hypws" || moduleIntent?.tab === "workspace"
      ? "workspace"
      : "editor";
  return (
    <TabbedModule
      key={initialKey}
      initialKey={initialKey}
      tabs={[
        { key: "editor", label: "Editor", Component: SoundShift },
        {
          key: "workspace",
          label: "Workspace",
          Component: HypothesisWorkspace,
        },
      ]}
    />
  );
}
