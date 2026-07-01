/**
 * invinoveritas MetaMask Snap — an INDEPENDENT verdict on a transaction before you sign it.
 *
 * MetaMask's built-in checks tell you *what* a transaction does. They don't tell you whether a
 * party that ISN'T your agent judged it safe — and they leave no portable, recomputable record.
 * This Snap intercepts every transaction via `onTransaction` (the transaction-insight endowment),
 * sends the prepared tx to invinoveritas `/review` (artifactType="onchain_action" — deterministic
 * scam/drainer/unlimited-approval/address-poisoning/slippage checks), and renders the verdict plus
 * a portable proof anyone can re-verify offline at /verify-proof. Advisory: it informs you; the
 * decision to sign stays yours.
 *
 * Architecture: this is a thin ADAPTER over invinoveritas-governance-gate-core. The core owns the
 * verdict + proof + fail-mode logic; this file owns only the MetaMask surface (decode tx -> artifact,
 * render insight panel). Same core powers the LangGraph / OpenAI-Agents / GOAT adapters.
 */
import type { OnTransactionHandler, OnRpcRequestHandler } from "@metamask/snaps-sdk";
import { panel, heading, text, divider, copyable } from "@metamask/snaps-sdk";
import { reviewAction, type GateResult } from "invinoveritas-governance-gate-core";

interface SnapConfig {
  /** Bearer API key for /review. Set via the `setApiKey` RPC method. Without it, the panel explains how to get one. */
  apiKey?: string;
  /** Override the API base (testing). Default https://api.babyblueviper.com */
  baseUrl?: string;
}

async function getConfig(): Promise<SnapConfig> {
  const state = (await snap.request({
    method: "snap_manageState",
    params: { operation: "get" },
  })) as SnapConfig | null;
  return state ?? {};
}

function hexWeiToEth(valueHex: string | undefined): string {
  if (!valueHex || valueHex === "0x" || valueHex === "0x0") return "0";
  try {
    const wei = BigInt(valueHex);
    // 18 decimals, trimmed
    const whole = wei / 10n ** 18n;
    const frac = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return valueHex;
  }
}

const VERDICT_LABEL: Record<string, string> = {
  approve: "✅ APPROVE — independent verdict found no blocking issues",
  approve_with_concerns: "⚠️ APPROVE WITH CONCERNS — review the issues below before signing",
  reject: "⛔ REJECT — an independent verdict flags this as unsafe",
  review_unavailable: "ℹ️ Verdict unavailable — this check is advisory and never blocks signing",
};

function renderResult(result: GateResult, verifyUrl: string) {
  const out: any[] = [
    heading("invinoveritas — independent verdict"),
    text(VERDICT_LABEL[result.verdict] ?? result.verdict),
  ];

  if (typeof result.confidence === "number") {
    out.push(text(`Confidence: **${Math.round(result.confidence * 100)}%**`));
  }
  if (result.summary) {
    out.push(divider(), text(result.summary));
  }

  const issues = (result.issues ?? []) as Array<Record<string, any>>;
  if (issues.length) {
    out.push(divider(), heading("Issues"));
    for (const issue of issues.slice(0, 5)) {
      const sev = issue.severity ? `[${String(issue.severity).toUpperCase()}] ` : "";
      const title = issue.title ?? issue.detail ?? JSON.stringify(issue);
      out.push(text(`${sev}${title}`));
      if (issue.recompute) out.push(text(`↳ recompute: ${issue.recompute}`));
    }
  }

  if (result.reason) {
    out.push(divider(), text(result.reason));
  }

  // The differentiator: a portable proof anyone can re-verify WITHOUT trusting the presenter or us.
  if (result.proof) {
    out.push(
      divider(),
      heading("Recomputable proof"),
      text(
        "This verdict is a BIP-340-signed, Bitcoin-anchored event. Recompute it yourself (free, no auth) — " +
          "trust the math, not us:",
      ),
      copyable(verifyUrl),
    );
  }

  return panel(out);
}

/**
 * Transaction-insight handler. Fires on every outgoing tx; returns an insight panel.
 * Never blocks signing (MetaMask insight is advisory by design) — failMode "open".
 */
export const onTransaction: OnTransactionHandler = async ({ transaction, chainId }) => {
  const cfg = await getConfig();
  const baseUrl = cfg.baseUrl ?? "https://api.babyblueviper.com";

  if (!cfg.apiKey) {
    return {
      content: panel([
        heading("invinoveritas — independent verdict"),
        text(
          "No API key configured. Get one free, then set it once to enable independent, recomputable " +
            "verdicts on every transaction before you sign:",
        ),
        copyable(`POST ${baseUrl}/register {"label":"metamask"}`),
        text("Then call this Snap's `setApiKey` RPC method with your key."),
      ]),
    };
  }

  // Build the onchain_action artifact from the prepared tx. The server-side engine decodes the
  // calldata (it does NOT need us to decode it client-side) and returns deterministic findings.
  const artifact = JSON.stringify({
    to: transaction.to,
    from: transaction.from,
    value_wei: transaction.value,
    value_eth: hexWeiToEth(transaction.value as string | undefined),
    data: transaction.data,
    chainId,
  });

  const result = await reviewAction(
    {
      artifact,
      artifactType: "onchain_action",
      context: "Pre-sign review of a MetaMask transaction. Caller is about to sign this on-chain action.",
    },
    { apiKey: cfg.apiKey, baseUrl, failMode: "open", sign: true, timeoutMs: 6000 },
  );

  return { content: renderResult(result, `${baseUrl}/verify-proof`) };
};

/**
 * RPC surface for one-time configuration. `setApiKey` stores the Bearer key in encrypted snap state;
 * `clearApiKey` removes it. The key never leaves the user's MetaMask.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ request }) => {
  switch (request.method) {
    case "setApiKey": {
      const params = (request.params ?? {}) as { apiKey?: string; baseUrl?: string };
      if (!params.apiKey) throw new Error("setApiKey requires { apiKey }");
      const prev = await getConfig();
      const newState: Record<string, string> = { ...prev, apiKey: params.apiKey };
      const baseUrl = params.baseUrl ?? prev.baseUrl;
      if (baseUrl) newState.baseUrl = baseUrl;
      await snap.request({
        method: "snap_manageState",
        params: { operation: "update", newState },
      });
      return { ok: true };
    }
    case "clearApiKey": {
      await snap.request({ method: "snap_manageState", params: { operation: "clear" } });
      return { ok: true };
    }
    default:
      throw new Error(`Method not found: ${request.method}`);
  }
};
