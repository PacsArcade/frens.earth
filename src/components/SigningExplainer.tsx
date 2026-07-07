/**
 * WHAT AM I SIGNING? — the education Pac asked for after his first nos2x
 * prompt. Lives beside every sign button so the extension popup is never
 * a mystery. Rule of the arcade: never sign what you can't read.
 */
export default function SigningExplainer({ kind }: { kind: "login" | "seat" | "profile" }) {
  return (
    <details className="border-2 border-edge bg-void px-4 py-3">
      <summary className="cursor-pointer font-pixel text-[9px] uppercase text-cyan">
        WHAT AM I SIGNING? ▸
      </summary>
      <div className="mt-3 space-y-2 font-body text-xs leading-relaxed text-white/70">
        {kind === "profile" ? (
          <>
            <p>
              Your extension will show a{" "}
              <span className="font-mono text-cyan">kind: 0</span>{" "}event — your profile card.
              Unlike a login challenge, this one{" "}
              <span className="text-coin">IS published</span>: it goes to the relays and becomes
              what every nostr app shows for you. Public by design — that&apos;s the point.
            </p>
            <p>
              Read it before approving: everything in it should be exactly what you typed here,
              nothing more. It replaces your previous card in one piece, and it still{" "}
              <span className="text-neon">cannot move money</span> — signing is a signature, not
              a spend.
            </p>
            <p>
              And the standing rule: if an extension ever shows you something you can&apos;t
              read — don&apos;t sign it. Anywhere. Ever.
            </p>
          </>
        ) : (
          <>
            <p>
              Your extension will show a small event to approve. Read it — that habit is the
              whole security model:
            </p>
            <p>
              <span className="font-mono text-cyan">
                {kind === "login" ? "PACS-LOGIN-<time>" : "PACS-SEAT-<class>-<run>-<tag>-<time>-NONCE-…"}
              </span>{" "}
              — the message. It proves your key answered{" "}
              <span className="text-coin">right now</span>{" "}(the timestamp expires in minutes, so a
              copy is worthless later). No name, no tracking, nothing hidden.
            </p>
            <p>
              <span className="font-mono text-cyan">kind: 22242</span> — an auth-only event type.
              It never gets published to relays, never appears on your feed, and{" "}
              <span className="text-neon">cannot move money</span> — signing is a signature, not a
              spend.
            </p>
            <p>
              Press{" "}
              <span className="text-coin">authorize / sign once</span> — not &quot;always
              allow&quot; until you trust a site. And if an extension ever shows you something you
              can&apos;t read: don&apos;t sign it. Anywhere. Ever.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
