import { useWorkbench } from "../store/workbench";
import { HoverPreview } from "./HoverPreview";

export function InscriptionLink({ id }: { id: string }) {
  const showInscription = useWorkbench((s) => s.showInscription);
  const hoverEnabled = useWorkbench((s) => s.settings.hoverPreviews);
  const link = (
    <button
      type="button"
      className="word-link"
      onClick={() => showInscription(id)}
    >
      {id}
    </button>
  );
  return hoverEnabled ? (
    <HoverPreview kind="inscription" value={id}>
      {link}
    </HoverPreview>
  ) : (
    link
  );
}
