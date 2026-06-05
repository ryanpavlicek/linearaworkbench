import { useWorkbench } from "../store/workbench";
import { ALL_MODULES, MODULE_ALIASES } from "../modules/registry";

// Calibration badge that appears at the very top of the panel for every
// analytical module, surfacing the descriptive vs exploratory distinction at
// the point of use. The categorization comes from each ModuleDef in the
// registry; modules without a `category` (utilities, workspaces, help) render
// nothing. Tooltip spells out what the category means so a careful reader
// doesn't have to guess.
//
// This is the in-app version of what the README and METHODOLOGY already say
// — the feedback's "Clearer documentation of which modules are more
// exploratory vs. more descriptive" specifically asked for this to be
// visible inside the tool, not just in the docs.
export function CategoryBadge() {
  const activeId = useWorkbench((s) => s.activeModule);
  // Aliases route to a primary entry; look that one up for the category.
  const primaryId = MODULE_ALIASES[activeId] ?? activeId;
  const def = ALL_MODULES.find((m) => m.id === primaryId);
  if (!def?.category) return null;
  const isDescriptive = def.category === "descriptive";
  const label = isDescriptive ? "Descriptive" : "Exploratory";
  const tooltip = isDescriptive
    ? "Descriptive — direct counts and structural observations from the corpus. The numbers are facts about what's in the data; the interpretation of those numbers is still yours."
    : "Exploratory — heuristic / interpretive output. Treat as hypothesis to verify against primary sources, not as evidence in itself. The reasoning is documented in the module and in the Methodology page.";
  return (
    <div className="module-category-row">
      <span
        className={`module-category-badge module-category-${def.category}`}
        title={tooltip}
      >
        <span className="module-category-dot" />
        {label}
      </span>
    </div>
  );
}
