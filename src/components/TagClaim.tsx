"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateSecretKey, getPublicKey, nip19, SimplePool, finalizeEvent } from "nostr-tools";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

interface ForgedKeys {
  npub: string;
  nsec: string;
}

declare global {
  interface Window {
    nostr?: { getPublicKey: () => Promise<string> };
  }
}

/* Render a key as equal-width monospace lines so it never wraps awkwardly.
   Blurred mode keeps the characters unreadable and unselectable — pair it
   with click-to-copy so the key can travel without ever being displayed. */
function KeyLines({ value, blurred, reveal }: { value: string; blurred?: boolean; reveal?: boolean }) {
  const chunks = value.match(/.{1,16}/g) ?? [];
  return (
    <span
      className={`block text-center font-mono text-sm leading-relaxed tracking-wider ${
        reveal ? "nsec-reveal select-all" : blurred ? "nsec-blur" : "select-all"
      }`}
    >
      {chunks.map((c, i) => (
        <span key={i} className="block">
          {c}
        </span>
      ))}
    </span>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / stricter permission contexts: hidden-textarea fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* Old-school RPG dialog box — the tutorial voice of the arcade. */
function RPGDialog({
  tone,
  title,
  onClose,
  children,
}: {
  tone: "info" | "danger";
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const border = tone === "danger" ? "border-ghost danger-pulse" : "border-cyan";
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 px-4">
      <div
        className={`w-full max-w-lg border-4 bg-[#0a0a14] p-6 ${border}`}
        role="dialog"
        aria-label={title}
      >
        <p className={`font-pixel text-xs mb-4 ${tone === "danger" ? "text-ghost glow-ghost" : "text-cyan glow-cyan"}`}>
          {title}
        </p>
        <div className="font-body text-sm text-white/85 space-y-3">{children}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-5 block w-full border-2 border-white/30 py-2 font-pixel text-xs text-white hover:border-coin hover:text-coin"
          >
            ▼ CONTINUE
          </button>
        )}
      </div>
    </div>
  );
}

export default function TagClaim({
  space,
  nip05Domain,
  onHandlePreview,
}: {
  space: string;
  nip05Domain: string;
  /** Live echo of the typed handle, so the page around the machine can react */
  onHandlePreview?: (handle: string) => void;
}) {
  const [handle, setHandle] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [takenNpub, setTakenNpub] = useState<string | null>(null);

  // "already yours?" — recognize the tag's owner by their public key
  const [ownershipOpen, setOwnershipOpen] = useState(false);
  const [ownershipValue, setOwnershipValue] = useState("");
  const [ownership, setOwnership] = useState<"idle" | "match" | "nomatch" | "invalid">("idle");

  const [npub, setNpub] = useState<string | null>(null);
  const [forged, setForged] = useState<ForgedKeys | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [hasNip07, setHasNip07] = useState(false);

  const [keyMode, setKeyMode] = useState<"choose" | "have" | "forged">("choose");
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"none" | "pubkey" | "danger-warn" | "danger-reveal">("none");
  const [pubAccepted, setPubAccepted] = useState(false);
  const [copied, setCopied] = useState<"none" | "pub" | "sec" | "nip05">("none");
  const [profilePublish, setProfilePublish] = useState<"idle" | "publishing" | "done" | "failed">("idle");

  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<{ handle: string; queuePosition: number } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHasNip07(typeof window !== "undefined" && !!window.nostr);
  }, []);
  const spaceTag = `@${space}`;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setTakenNpub(null);
    setOwnershipOpen(false);
    setOwnershipValue("");
    setOwnership("idle");
    if (!handle) {
      setAvailability("idle");
      setReason(null);
      return;
    }
    setAvailability("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/frens/availability?handle=${encodeURIComponent(handle)}&space=${encodeURIComponent(space)}`
        );
        const data = await res.json();
        if (data.available) {
          setAvailability("available");
          setReason(null);
        } else {
          setAvailability(data.reason === "already claimed" ? "taken" : "invalid");
          setReason(data.reason);
          if (typeof data.npub === "string") setTakenNpub(data.npub);
        }
      } catch {
        setAvailability("idle");
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [handle, space]);

  const checkOwnership = useCallback(
    (candidate: string) => {
      const v = candidate.trim().toLowerCase();
      if (v.startsWith("nsec1")) {
        setOwnership("invalid");
        return;
      }
      try {
        const decoded = nip19.decode(v);
        if (decoded.type !== "npub") throw new Error();
        setOwnership(v === takenNpub ? "match" : "nomatch");
      } catch {
        setOwnership("invalid");
      }
    },
    [takenNpub]
  );

  const checkOwnershipNip07 = useCallback(async () => {
    try {
      const hex = await window.nostr!.getPublicKey();
      setOwnership(nip19.npubEncode(hex) === takenNpub ? "match" : "nomatch");
    } catch {
      /* user dismissed the extension prompt */
    }
  }, [takenNpub]);

  const connectNip07 = useCallback(async () => {
    try {
      const hex = await window.nostr!.getPublicKey();
      setNpub(nip19.npubEncode(hex));
      setForged(null);
      setSavedConfirmed(true); // their extension already guards the key
    } catch {
      /* user dismissed the extension prompt */
    }
  }, []);

  const acceptPastedKey = useCallback(() => {
    const v = pasteValue.trim().toLowerCase();
    if (v.startsWith("nsec1")) {
      setPasteError(
        "STOP — that is your SECRET key. Anything you paste it into can act as you. We only need your PUBLIC key (starts with npub1)."
      );
      setPasteValue("");
      return;
    }
    try {
      const decoded = nip19.decode(v);
      if (decoded.type !== "npub") throw new Error();
      setNpub(v);
      setForged(null);
      setSavedConfirmed(true); // they already custody their own keys
      setPasteError(null);
    } catch {
      setPasteError("That doesn't look like a public key (npub1…). Check for typos — keys are always lowercase.");
    }
  }, [pasteValue]);

  const forgeKeys = useCallback(() => {
    const sk = generateSecretKey();
    const keys = { npub: nip19.npubEncode(getPublicKey(sk)), nsec: nip19.nsecEncode(sk) };
    setForged(keys);
    setNpub(keys.npub);
    setSavedConfirmed(false);
    setPubAccepted(false); // every fresh key gets the full ceremony, public first
    setCopied("none");
    setKeyMode("forged");
  }, []);

  const claim = useCallback(async () => {
    if (!npub || availability !== "available") return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/frens/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, npub, space }),
      });
      const data = await res.json();
      if (data.ok) {
        setClaimed({ handle: data.entry.handle, queuePosition: data.queuePosition });
      } else {
        setClaimError(data.reason ?? "claim failed");
      }
    } catch {
      setClaimError("network error — try again");
    } finally {
      setClaiming(false);
    }
  }, [handle, npub, availability]);

  /* Freshly forged keys have a blank profile, so apps show a bare npub. This
     signs a starter kind-0 (name + verified NIP-05 address) IN THE BROWSER
     and broadcasts it to public relays — the secret key never leaves the
     page. Existing keys are never touched: publishing a kind-0 would replace
     whatever profile they already have. */
  const publishStarterProfile = useCallback(async () => {
    if (!forged || !claimed) return;
    setProfilePublish("publishing");
    const relays = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
    const pool = new SimplePool();
    try {
      const sk = nip19.decode(forged.nsec).data as Uint8Array;
      const event = finalizeEvent(
        {
          kind: 0,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({
            name: claimed.handle,
            display_name: claimed.handle,
            nip05: `${claimed.handle}@${nip05Domain}`,
          }),
        },
        sk
      );
      // one relay accepting is enough — the network gossips from there
      await Promise.race([
        Promise.any(pool.publish(relays, event)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      setProfilePublish("done");
    } catch {
      setProfilePublish("failed");
    } finally {
      pool.close(relays);
    }
  }, [forged, claimed, nip05Domain]);

  const statusLine = {
    idle: { text: "TYPE A NAME TO CHECK THE BOARD", cls: "text-cyan glow-cyan" },
    checking: { text: "CHECKING…", cls: "text-coin glow-coin pulse-neon" },
    available: { text: "TAG AVAILABLE — PRESS START", cls: "text-neon glow-neon" },
    taken: { text: "TAKEN — TRY ANOTHER", cls: "text-ghost glow-ghost" },
    invalid: { text: (reason ?? "INVALID NAME").toUpperCase(), cls: "text-ghost glow-ghost" },
  }[availability];

  /* ---------- SUCCESS ---------- */
  if (claimed) {
    const nip05Id = `${claimed.handle}@${nip05Domain}`;
    const nip05Pill = (
      <button
        onClick={async () => {
          if (await copyToClipboard(nip05Id)) setCopied("nip05");
        }}
        className="border border-cyan/60 px-2 py-0.5 font-mono text-xs text-cyan hover:bg-cyan/10"
        aria-label="Copy your verified address"
      >
        {copied === "nip05" ? "✓ copied" : nip05Id}
      </button>
    );
    return (
      <div className="mx-auto max-w-2xl border-4 border-neon bg-panel p-8 shadow-[8px_8px_0_#ff00ff]">
        <p className="text-center font-pixel text-2xl text-neon glow-neon mb-6">PLAYER REGISTERED</p>
        <p className="text-center font-arcade text-[clamp(1.4rem,7vw,2.25rem)] leading-tight break-all text-coin glow-coin mb-8">
          {claimed.handle}
          {spaceTag}
        </p>

        {forged && (
          <div className="mb-8 border-2 border-cyan/60 p-4">
            <p className="font-pixel text-xs text-cyan mb-3">FINAL STEP — PIN YOUR NAME TO YOUR KEY</p>
            <p className="font-body text-sm text-white/80 mb-4">
              A brand-new key has a blank profile, so chat apps would show you as a long code
              instead of <span className="text-coin">{claimed.handle}{spaceTag}</span>. Publish a
              starter profile — your name plus your verified address — signed right here in your
              browser. Your secret key never leaves this page.
            </p>
            <button
              onClick={publishStarterProfile}
              disabled={profilePublish === "publishing" || profilePublish === "done"}
              className="button w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profilePublish === "idle" && "PUBLISH MY PROFILE"}
              {profilePublish === "publishing" && "BROADCASTING…"}
              {profilePublish === "done" && "✓ PROFILE PUBLISHED"}
              {profilePublish === "failed" && "RELAYS DIDN'T ANSWER — TRY AGAIN"}
            </button>
            {profilePublish === "done" && (
              <p className="mt-3 font-body text-xs text-neon">
                Done — apps now show you as {claimed.handle}{spaceTag}, verified as{" "}
                <span className="text-cyan">{nip05Id}</span> (give them a minute to notice).
              </p>
            )}
          </div>
        )}

        <p className="font-pixel text-xs text-cyan mb-4">WHAT NOW?</p>
        <div className="font-body text-sm text-white/80 space-y-3">
          <p>
            <span className="text-neon font-pixel text-xs mr-2">CHAT</span>
            Your tag works on{" "}
            <a
              href="https://nostr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:glow-cyan underline"
            >
              nostr
            </a>
            {" "}— an open chat network no company owns. Open any nostr app (Primal, Damus,
            Amethyst), sign in with your key, and you can post, message, and follow other frens by
            their tags.
          </p>
          <p>
            <span className="text-neon font-pixel text-xs mr-2">VERIFY</span>
            {forged
              ? "Published above — but you can always set it yourself too: "
              : "Already have a profile? Don't change anything else — just "}
            open your app&apos;s profile settings and paste {nip05Pill}{" "}into the{" "}
            <a
              href="https://github.com/nostr-protocol/nips/blob/master/05.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:glow-cyan underline"
            >
              &quot;Verified Nostr Address (NIP-05)&quot;
            </a>
            {" "}field. It looks like an email address but it isn&apos;t one — it&apos;s how nostr
            proves your name belongs to your key.
          </p>
          <p>
            <span className="text-coin font-pixel text-xs mr-2">SOON</span>
            You&apos;re #{claimed.queuePosition} in the queue for the next batch. Batches
            aren&apos;t tied to Bitcoin blocks — when the queue fills, Pac&apos;s Arcade anchors
            every new tag to Bitcoin in one transaction, and we announce each batch from{" "}
            <span className="text-pink">@pacsarcade</span>{" "}on nostr. Nothing to wait on: your
            tag already works everywhere — the batch just makes it permanent.
          </p>
        </div>
      </div>
    );
  }

  /* ---------- DIALOGS ---------- */
  const dialogs = (
    <>
      {dialog === "pubkey" && npub && (
        <RPGDialog
          tone="info"
          title="★ TUTORIAL — THE PUBLIC KEY"
          onClose={() => {
            setPubAccepted(true);
            setDialog("none");
          }}
        >
          <p>
            This is your <strong className="text-cyan">PUBLIC key</strong>. It&apos;s safe to share
            with anyone — it&apos;s how the world finds you. Your tag{" "}
            <span className="text-coin">{handle || "yourname"}{spaceTag}</span>{" "}will point to it.
          </p>
          <div className="border-2 border-cyan/40 bg-black/60 p-3 text-cyan">
            <KeyLines value={npub} />
          </div>
          <button
            onClick={async () => {
              if (await copyToClipboard(npub)) setCopied("pub");
            }}
            className="w-full border-2 border-cyan/60 py-2 font-pixel text-xs text-cyan hover:bg-cyan/10"
          >
            {copied === "pub" ? "✓ COPIED" : "COPY PUBLIC KEY"}
          </button>
          <p className="text-white/60 text-xs">
            Keys are always lowercase — if you ever see capital letters, something copied wrong.
          </p>
        </RPGDialog>
      )}
      {dialog === "danger-warn" && (
        <RPGDialog tone="danger" title="⚠ DANGER ZONE — READ BEFORE OPENING">
          <p className="shake">
            Behind this door is your <strong className="text-ghost">SECRET key</strong>. Whoever
            holds it <em>is</em>{" "}you — forever. There is no reset button, no support line, no
            &quot;forgot password.&quot;
          </p>
          <p>Rules of the vault:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/75">
            <li>
              Any website, app, or AI you enter it into gains full authority to act as you —
              post, message, and send in your name.
            </li>
            <li>
              The only place it belongs is the sign-in screen of a nostr app you trust. This
              site never asks for it.
            </li>
            <li>Never screenshot it to your camera roll.</li>
            <li>Write it on paper, or store it in a password manager.</li>
          </ul>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDialog("none")}
              className="flex-1 border-2 border-white/30 py-2 font-pixel text-xs text-white hover:border-cyan"
            >
              GO BACK
            </button>
            <button
              onClick={() => setDialog("danger-reveal")}
              className="flex-1 border-2 border-ghost py-2 font-pixel text-xs text-ghost glow-ghost hover:bg-ghost/20"
            >
              I UNDERSTAND — OPEN
            </button>
          </div>
        </RPGDialog>
      )}
      {dialog === "danger-reveal" && forged && (
        <RPGDialog tone="danger" title="🗝 THE SECRET KEY — COPY FIRST, THEN VERIFY" onClose={() => setDialog("none")}>
          <p>
            <strong className="text-ghost">Tap the key to copy it to your clipboard</strong>{" "}—
            it stays blurred until it&apos;s safely copied, then reveals so you can double-check
            what you paste into your password manager or write down.
          </p>
          <button
            onClick={async () => {
              if (await copyToClipboard(forged.nsec)) setCopied("sec");
            }}
            className={`w-full border-2 bg-black/60 p-3 text-left text-coin transition-colors ${
              copied === "sec" ? "border-neon" : "border-ghost/60 hover:border-ghost"
            }`}
            aria-label="Copy secret key to clipboard"
          >
            <KeyLines value={forged.nsec} blurred={copied !== "sec"} reveal={copied === "sec"} />
            <span className={`mt-2 block text-center font-pixel text-xs ${copied === "sec" ? "text-neon glow-neon" : "text-ghost glow-ghost"}`}>
              {copied === "sec" ? "✓ COPIED — PASTE IT SOMEWHERE SAFE NOW" : "▲ TAP TO COPY"}
            </span>
          </button>
          <p className="text-white/60 text-xs">
            It only exists here in your browser — we never see it and can&apos;t recover it later.
            That&apos;s the point: nobody can take your tag, because nobody but you holds the key.
          </p>
          <label className="flex items-start gap-3 text-white">
            <input
              type="checkbox"
              checked={savedConfirmed}
              onChange={(e) => setSavedConfirmed(e.target.checked)}
              disabled={copied !== "sec" && !savedConfirmed}
              className="mt-1 h-4 w-4 accent-[#39ff14]"
            />
            I saved my secret key somewhere safe.
          </label>
        </RPGDialog>
      )}
    </>
  );

  /* ---------- MAIN FLOW ---------- */
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {dialogs}

      {/* STEP 1 — the tag grows leftward out of the space tag */}
      <div className="border-2 border-edge bg-panel p-6">
        <p className="font-pixel text-xs text-cyan mb-4">STEP 1 — PICK YOUR TAG</p>
        <div className="flex items-center border-4 border-coin bg-void px-3 py-3 focus-within:border-neon sm:px-4">
          <input
            value={handle}
            onChange={(e) => {
              const next = e.target.value.toLowerCase();
              setHandle(next);
              onHandlePreview?.(next.trim());
            }}
            maxLength={20}
            spellCheck={false}
            autoComplete="off"
            placeholder="name"
            dir="ltr"
            className="min-w-0 flex-1 bg-transparent text-right font-arcade text-xl text-coin outline-none [caret-color:transparent] placeholder:text-white/20 sm:text-2xl"
            aria-label="Choose your handle"
          />
          <span className="blink mx-0.5 inline-block h-5 w-2.5 shrink-0 bg-coin sm:h-6 sm:w-3" aria-hidden />
          <span className="shrink-0 font-arcade text-xl text-pink glow-pink select-none sm:text-2xl">{spaceTag}</span>
        </div>
        <p className={`mt-3 font-pixel text-xs ${statusLine.cls}`} role="status">
          {statusLine.text}
        </p>
        {availability === "taken" && takenNpub && (
          <div className="mt-4 border-t border-dashed border-edge pt-3">
            {!ownershipOpen ? (
              <button
                onClick={() => setOwnershipOpen(true)}
                className="font-pixel text-xs text-cyan underline hover:glow-cyan"
              >
                IS THIS TAG YOURS?
              </button>
            ) : (
              <div className="space-y-3">
                <p className="font-body text-xs text-white/60">
                  Every tag is bound to a public key. Show us yours — connect your{" "}
                  {hasNip07 ? (
                    <button
                      onClick={checkOwnershipNip07}
                      className="text-cyan hover:glow-cyan underline"
                    >
                      nostr extension
                    </button>
                  ) : (
                    <span className="text-cyan">nostr extension</span>
                  )}
                  {" "}(
                  <a
                    href="https://github.com/nostr-protocol/nips/blob/master/07.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan hover:glow-cyan underline"
                  >
                    NIP-07
                  </a>
                  ) or paste your <span className="text-cyan">public</span>{" "}key (npub1…) —
                  and we&apos;ll check it against the key{" "}
                  <span className="text-coin">{handle}{spaceTag}</span>{" "}is bound to.
                </p>
                <div className="flex gap-2">
                  <input
                    value={ownershipValue}
                    onChange={(e) => {
                      setOwnershipValue(e.target.value);
                      setOwnership("idle");
                    }}
                    placeholder="npub1…"
                    spellCheck={false}
                    className="min-w-0 flex-1 border-2 border-edge bg-void px-3 py-2 font-body text-sm text-cyan outline-none focus:border-cyan"
                    aria-label="Paste your npub to check ownership"
                  />
                  <button
                    onClick={() => checkOwnership(ownershipValue)}
                    className="button shrink-0 !px-4 !py-2 !text-xs"
                  >
                    Check
                  </button>
                </div>
                {ownership === "match" && (
                  <div className="space-y-2 border-2 border-neon/60 bg-neon/5 p-3">
                    <p className="font-pixel text-xs text-neon glow-neon">
                      ✓ THIS TAG IS BOUND TO YOUR KEY
                    </p>
                    <p className="font-body text-xs text-white/70">
                      To show it in chat apps, open your profile settings and paste{" "}
                      <button
                        onClick={async () => {
                          if (await copyToClipboard(`${handle}@${nip05Domain}`)) setCopied("nip05");
                        }}
                        className="border border-cyan/60 px-2 py-0.5 font-mono text-cyan hover:bg-cyan/10"
                      >
                        {copied === "nip05" ? "✓ copied" : `${handle}@${nip05Domain}`}
                      </button>
                      {" "}into the{" "}
                      <a
                        href="https://github.com/nostr-protocol/nips/blob/master/05.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan hover:glow-cyan underline"
                      >
                        &quot;Verified Nostr Address (NIP-05)&quot;
                      </a>
                      {" "}field. Profile pages are coming — you&apos;ll manage your whole card
                      from here.
                    </p>
                  </div>
                )}
                {ownership === "nomatch" && (
                  <p className="font-pixel text-xs text-ghost glow-ghost">
                    DIFFERENT KEY HOLDS THIS TAG — TRY ANOTHER NAME
                  </p>
                )}
                {ownership === "invalid" && (
                  <p className="font-pixel text-xs text-ghost glow-ghost">
                    THAT&apos;S NOT A PUBLIC KEY (NPUB1…) — NEVER PASTE YOUR SECRET KEY
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {availability === "available" && (
          <div className="mt-4 space-y-1 border-t border-dashed border-edge pt-3 font-body text-xs text-white/60">
            <p>
              <span className="font-pixel text-[10px] text-coin mr-2">ON BITCOIN</span>
              <span className="text-coin">{handle}{spaceTag}</span>{" "}— your permanent tag, anchored
              on-chain at the next batch
            </p>
            <p>
              <span className="font-pixel text-[10px] text-cyan mr-2">ON NOSTR</span>
              <span className="text-cyan">{handle}@{nip05Domain}</span>{" "}— your verified chat
              identity, live the moment you claim
            </p>
          </div>
        )}
      </div>

      {/* STEP 2 — keys (locked until a tag is chosen) */}
      <div className="border-2 border-edge bg-panel p-6">
        <p className="font-pixel text-xs text-cyan mb-4">STEP 2 — GET YOUR KEYS</p>

        {availability !== "available" && !npub && (
          <p className="font-pixel text-xs text-white/30">
            🔒 LEVEL LOCKED — PICK AN AVAILABLE TAG FIRST
          </p>
        )}

        {availability === "available" && keyMode === "choose" && !npub && (
          <div className="flex flex-col gap-4 sm:flex-row">
            <button onClick={() => setKeyMode("have")} className="button flex-1">
              I have keys
            </button>
            <button onClick={forgeKeys} className="button flex-1">
              New player — forge keys
            </button>
          </div>
        )}

        {availability === "available" && keyMode === "have" && !npub && (
          <div className="space-y-4">
            {hasNip07 ? (
              <button onClick={connectNip07} className="button w-full">
                Connect nostr extension
              </button>
            ) : (
              <p className="font-body text-xs text-white/50">
                No nostr browser extension detected (Alby and nos2x are the common ones). You can
                paste your <span className="text-cyan">public</span>{" "}key instead:
              </p>
            )}
            <div className="flex gap-2">
              <input
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="npub1…"
                spellCheck={false}
                className="min-w-0 flex-1 border-2 border-edge bg-void px-3 py-2 font-body text-sm text-cyan outline-none focus:border-cyan"
                aria-label="Paste your npub public key"
              />
              <button onClick={acceptPastedKey} className="button shrink-0 !px-4 !py-2 !text-xs">
                Use it
              </button>
            </div>
            {pasteError && (
              <p className="border-2 border-ghost bg-ghost/10 p-3 font-pixel text-xs text-ghost glow-ghost">
                {pasteError}
              </p>
            )}
            <button
              onClick={() => setKeyMode("choose")}
              className="font-pixel text-xs text-white/40 underline hover:text-cyan"
            >
              back
            </button>
          </div>
        )}

        {npub && (
          <div className="space-y-4">
            {/* Public key card — inspect this first */}
            <button
              onClick={() => setDialog("pubkey")}
              className={`w-full border-2 bg-void p-4 text-left ${
                pubAccepted ? "border-neon/60 hover:border-neon" : "border-cyan/60 hover:border-cyan"
              }`}
            >
              <p className={`font-pixel text-xs mb-2 ${pubAccepted ? "text-neon glow-neon" : "text-cyan glow-cyan"}`}>
                {pubAccepted ? "✓ PUBLIC KEY — ACCEPTED" : "★ PUBLIC KEY — TAP TO INSPECT"}
              </p>
              <KeyLines value={npub} blurred={!pubAccepted && !!forged} />
              <p className="mt-2 font-body text-xs text-white/40">Safe to share. Your tag resolves to this.</p>
            </button>

            {/* Secret key vault — unlocks after the public key is understood */}
            {forged && (
              <button
                onClick={() => setDialog(savedConfirmed ? "danger-reveal" : "danger-warn")}
                disabled={!pubAccepted}
                className={`w-full border-2 p-4 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                  savedConfirmed
                    ? "border-neon/60 hover:border-neon"
                    : pubAccepted
                      ? "border-ghost/60 hover:border-ghost danger-pulse"
                      : "border-edge"
                }`}
              >
                <p className={`font-pixel text-xs mb-2 ${savedConfirmed ? "text-neon glow-neon" : "text-ghost glow-ghost"}`}>
                  {savedConfirmed
                    ? "✓ SECRET KEY — SECURED"
                    : pubAccepted
                      ? "🔒 SECRET KEY — CLICK TO UNLOCK THE VAULT"
                      : "🔒 SECRET KEY — INSPECT YOUR PUBLIC KEY FIRST"}
                </p>
                <KeyLines value={forged.nsec} blurred />
                <p className="mt-2 font-body text-xs text-white/40">
                  {savedConfirmed
                    ? "Copied and confirmed saved. Tap to copy again."
                    : "Private. Powerful. Blurred until you copy it — then it reveals for a double-check."}
                </p>
              </button>
            )}

            <button
              onClick={() => {
                setNpub(null);
                setForged(null);
                setSavedConfirmed(false);
                setPubAccepted(false);
                setCopied("none");
                setKeyMode("choose");
              }}
              className="font-pixel text-xs text-white/40 underline hover:text-ghost"
            >
              start over with different keys
            </button>
          </div>
        )}
      </div>

      {/* STEP 3 — lock it in */}
      <div className="border-2 border-edge bg-panel p-6">
        <p className="font-pixel text-xs text-cyan mb-4">STEP 3 — LOCK IT IN</p>
        <button
          onClick={claim}
          disabled={availability !== "available" || !npub || !savedConfirmed || claiming}
          className="button w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          {claiming ? "INSERTING COIN…" : "CLAIM YOUR TAG — FREE"}
        </button>
        {claimError && (
          <p className="mt-3 font-pixel text-xs text-ghost glow-ghost">{claimError.toUpperCase()}</p>
        )}
        <p className="mt-3 font-body text-xs text-white/50">
          Free forever. No email, no password, no account — your keys are your login.
        </p>
      </div>
    </div>
  );
}
