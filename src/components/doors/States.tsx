export function Loading({ what }: { what: string }) {
  return (
    <div className="door-panel door-state" role="status" aria-live="polite">
      <p className="door-state__head">Listening to the relays</p>
      <p className="door-state__text">Reading {what} from public nostr relays. This can take a few seconds.</p>
    </div>
  );
}

export function Empty({ head, text }: { head: string; text: string }) {
  return (
    <div className="door-panel door-state">
      <p className="door-state__head">{head}</p>
      <p className="door-state__text">{text}</p>
    </div>
  );
}

export const SIGNER_NOTE = "Signer needed, coming next.";

export function SignerNote() {
  return <p className="door-note">{SIGNER_NOTE}</p>;
}
