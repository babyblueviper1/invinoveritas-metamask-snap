# invinoveritas — verify before you sign (MetaMask Snap)

An **independent, recomputable verdict on every transaction before you sign it**.

MetaMask's built-in checks tell you *what* a transaction does. They don't tell you whether a party
that **isn't your agent** judged it safe — and they leave no portable, recomputable record. This Snap
intercepts every outgoing transaction (`onTransaction` / the transaction-insight endowment), sends the
prepared tx to invinoveritas [`/review`](https://api.babyblueviper.com) (`artifactType="onchain_action"`
— deterministic scam / drainer / unlimited-approval / address-poisoning / slippage checks), and renders
the verdict **plus a Bitcoin-anchored proof anyone can re-verify offline** at `/verify-proof`.

**Advisory:** it informs you; the decision to sign stays yours. It never blocks signing.

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
