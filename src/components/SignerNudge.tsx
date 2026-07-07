/**
 * The gear-up nudge, shared by login and the profile editor: no signer
 * extension in this browser, here are the two doors. Never an nsec paste
 * box — the sign-in screen of a signer is the only place a key belongs.
 */
export default function SignerNudge() {
  return (
    <div className="border-2 border-coin/60 bg-void p-4">
      <p className="mb-2 font-pixel text-[10px] uppercase text-coin">
        NO KEY SIGNER IN THIS BROWSER
      </p>
      <p className="font-body text-sm text-white/70">
        Install a signer extension, add your key, reload:{" "}
        <a
          href="https://github.com/fiatjaf/nos2x"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan underline"
        >
          nos2x
        </a>{" "}(just the signer, simplest) or{" "}
        <a
          href="https://getalby.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan underline"
        >
          Alby
        </a>{" "}(signer + wallet features later). A key is not a wallet — lesson one.
      </p>
    </div>
  );
}
