import { useWorkbench } from "../store/workbench";
import { HoverPreview } from "./HoverPreview";

export function InscriptionLink({ id }: { id: string }) {
  const showInscription = useWorkbench((s) => s.showInscription);
  const hoverEnabled = useWorkbench((s) => s.settings.hoverPreviews);
  const link = (
    <span className="word-link" onClick={() => showInscription(id)}>
      {id}
    </span>
  );
  return hoverEnabled ? (
    <HoverPreview kind="inscription" value={id}>
      {link}
    </HoverPreview>
  ) : (
    link
  );
}
