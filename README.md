# invinoveritas — verify before you sign (MetaMask Snap)

An **independent, recomputable verdict on every transaction before you sign it**.

MetaMask's built-in checks tell you *what* a transaction does. They don't tell you whether a party
that **isn't your agent** judged it safe — and they leave no portable, recomputable record. This Snap
intercepts every outgoing transaction (`onTransaction` / the transaction-insight endowment), sends the
prepared tx to invinoveritas [`/review`](https://api.babyblueviper.com) (`artifactType="onchain_action"`
— deterministic scam / drainer / unlimited-approval / address-poisoning / slippage checks), and renders
the verdict **plus a Bitcoin-anchored proof anyone can re-verify offline** at `/verify-proof`.

**Advisory:** it informs you; the decision to sign stays yours. It never blocks signing.

---

## For users — knowledge base

**What this Snap does, in one line:** before you sign any transaction, it shows an independent verdict (approve / approve-with-concerns / reject) on whether the transaction looks safe — checking for scam/honeypot tokens, wallet-drainer approvals, address poisoning, wrong-chain recipients, and bad slippage — and attaches a proof you can re-verify yourself. It is **advisory**: it never blocks or changes your transaction, it only informs you.

### Install it
1. Install **MetaMask Flask** (or MetaMask once this Snap is allowlisted).
2. Install the Snap by its ID `npm:invinoveritas-metamask-snap` — via the [Snaps directory](https://snaps.metamask.io) once listed, or the [Snap install tester](https://montoya.github.io/snap-install-tester/) for Flask.
3. Approve the permissions (transaction insights, network access) — see the permissions table below for why each is requested.

### First-time setup: your review key (one time, free)
The Snap calls the invinoveritas `/review` service, which needs a free API key. The key is stored **encrypted inside your MetaMask and never leaves it**.
1. Get a free key: `POST https://api.babyblueviper.com/register` with body `{"label":"metamask"}` (instant, no payment).
2. Set it in the Snap via `setApiKey` (see the developer snippet below), or through the companion dApp at https://api.babyblueviper.com.
3. To remove it later, use `clearApiKey`.

Without a key, the Snap still loads and the insight panel explains how to get one — it fails **open** (never blocks your transaction).

### Using it day to day
Just transact normally. On every transaction, an insight panel appears showing:
- **Verdict** — ✅ approve / ⚠️ approve-with-concerns / ⛔ reject, with a confidence score.
- **Up to 5 ranked issues**, each a deterministic finding with a `recompute:` pointer.
- **A recomputable proof** — the verdict is a BIP-340-signed, Bitcoin-anchored event; the panel links the `/verify-proof` URL so you (or anyone you forward it to) can confirm it offline without trusting us.

### Troubleshooting
- **"Verdict unavailable" / the panel shows a setup message** — no API key is set yet, or the review service was unreachable. Set your key (above) or retry; the Snap fails open, so your transaction is never blocked.
- **No panel appears** — confirm the Snap is enabled in *Settings → Snaps* and that it has the transaction-insight permission.
- **A verdict looks wrong** — it's advisory and deterministic; every finding carries a `recompute:` pointer so you can check the reasoning. Report disagreements via the support channel below.

### Privacy & safety
- Your API key is stored in encrypted Snap state and never leaves MetaMask.
- The Snap reads the transaction only to review it; it holds no keys, cannot sign, move funds, or access your accounts. It requests none of the key-management permissions.
- Transaction details are sent to the `/review` endpoint to produce the verdict; see https://api.babyblueviper.com for the data policy.

### Support
- Issues / questions: https://github.com/babyblueviper1/invinoveritas-metamask-snap/issues
- Email: fsllanos@gmail.com
- Service status & docs: https://api.babyblueviper.com

## Architecture

This is a thin **adapter** over [`invinoveritas-governance-gate-core`](../governance-gate-core). The
core owns the verdict + proof + fail-mode logic; this Snap owns only the MetaMask surface (decode tx →
artifact, render the insight panel). The same core powers the LangGraph / OpenAI-Agents / GOAT adapters
— one verdict primitive, many surfaces.

The settlement side is the irreversible-action surface itself. Where receipt-only schemes prove *what an
agent did* after the fact, this puts an **independent verdict in front of the signature**, with a proof
the recipient can recompute without trusting the signer.

## Install (development)

```bash
npm install
npm run build      # mm-snap build → dist/bundle.js (+ computes manifest shasum)
npm run serve      # serve locally for Flask/MetaMask Flask testing
```

Then connect from a dApp:

```ts
await window.ethereum.request({
  method: "wallet_requestSnaps",
  params: { "local:http://localhost:8080": {} },
});
```

## Configure your API key (one time)

The Snap needs an invinoveritas Bearer key to call `/review`. It's stored in encrypted Snap state and
**never leaves your MetaMask**. Get one free, then set it:

```ts
// free key: POST https://api.babyblueviper.com/register {"label":"metamask"}
await window.ethereum.request({
  method: "wallet_invokeSnap",
  params: {
    snapId: "local:http://localhost:8080",
    request: { method: "setApiKey", params: { apiKey: "YOUR_KEY" } },
  },
});
```

`clearApiKey` removes it.

## What you see

On every transaction, an insight panel:

- **Verdict** — ✅ approve / ⚠️ approve-with-concerns / ⛔ reject (+ confidence)
- **Summary** and up to 5 **issues** (each deterministic finding carries a `recompute:` pointer)
- **Recomputable proof** — the verdict is a BIP-340-signed, Bitcoin-anchored event; the panel gives you
  the `/verify-proof` URL to recompute it yourself. Trust the math, not us.

## Permissions (why each)

| Permission | Why |
|---|---|
| `endowment:transaction-insight` | read the prepared tx to review it before signing |
| `endowment:network-access` | call `/review` and `/verify-proof` |
| `endowment:rpc` (`dapps: true`) | `setApiKey` / `clearApiKey` configuration |
| `snap_manageState` | store the API key encrypted, locally |

## Publishing

`mm-snap build` recomputes `source.shasum` in `snap.manifest.json`. Publish the package to npm and
point users at the `npm:invinoveritas-metamask-snap` snap id. (The on-chain Safe-guard / ERC-4337
variant — verifying a signed verdict *on-chain* via our BIP340Verifier — is a separate artifact.)

## License

MIT
