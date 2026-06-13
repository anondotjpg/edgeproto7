import {
  CHAIN_CONFIG,
  DESTINATION_CONFIG,
  type DepositAsset,
  type DepositChain,
  getRelayRefundTo,
  getRelayUserAddress,
} from "@/lib/crypto-deposits";

type JsonRecord = Record<string, unknown>;

type RelayAmountResult = {
  amount: string;
  amountFormatted: string;
};

export type RelayIntentStatus =
  | "waiting"
  | "depositing"
  | "pending"
  | "submitted"
  | "success"
  | "delayed"
  | "refund"
  | "failure";

export type RelayStatusResponse = {
  status: RelayIntentStatus;
  details?: string | null;
  failReason?: string | null;
  refundFailReason?: string | null;
  inTxHashes?: string[];
  txHashes?: string[];
  updatedAt?: number;
  originChainId?: number;
  destinationChainId?: number;
  quoteCreatedAt?: number;
};

export type RelayDepositQuote = {
  requestId: string;
  depositAddress: string;
  amountInAtomic: string;
  amountInDisplay: string;
  originChainId: number;
  originCurrency: string;
  destinationChainId: number;
  destinationCurrency: string;
  quote: unknown;
};

const RELAY_API_BASE = process.env.RELAY_API_BASE ?? "https://api.relay.link";
const RELAY_API_KEY = process.env.RELAY_API_KEY;

function relayHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (RELAY_API_KEY) {
    headers["x-api-key"] = RELAY_API_KEY;
  }

  return headers;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function walk(
  value: unknown,
  visitor: (value: unknown) => string | null,
): string | null {
  const direct = visitor(value);

  if (direct) {
    return direct;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found: string | null = walk(item, visitor);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      const found: string | null = walk(item, visitor);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function findDepositAddress(quote: unknown): string | null {
  return walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const depositAddress = value.depositAddress;

    if (typeof depositAddress === "string" && depositAddress.length > 8) {
      return depositAddress;
    }

    if (
      isRecord(depositAddress) &&
      typeof depositAddress.address === "string" &&
      depositAddress.address.length > 8
    ) {
      return depositAddress.address;
    }

    return null;
  });
}

function findRequestId(quote: unknown): string | null {
  if (isRecord(quote) && Array.isArray(quote.steps)) {
    for (const step of quote.steps) {
      if (isRecord(step) && typeof step.requestId === "string") {
        return step.requestId;
      }

      if (isRecord(step) && Array.isArray(step.items)) {
        for (const item of step.items) {
          if (!isRecord(item)) continue;

          const check = item.check;

          if (
            isRecord(check) &&
            typeof check.endpoint === "string" &&
            check.endpoint.includes("requestId=")
          ) {
            const requestId = check.endpoint
              .split("requestId=")[1]
              ?.split("&")[0];

            if (requestId) return requestId;
          }
        }
      }
    }
  }

  return walk(quote, (value) => {
    if (!isRecord(value)) return null;

    return typeof value.requestId === "string" ? value.requestId : null;
  });
}

function getQuoteDetails(quote: unknown): JsonRecord | null {
  if (!isRecord(quote)) return null;

  const details = quote.details;

  return isRecord(details) ? details : null;
}

function parseRelayAmountResult(value: string): RelayAmountResult | null {
  try {
    const parsed = JSON.parse(value);

    if (!isRecord(parsed)) return null;

    if (
      typeof parsed.amount === "string" &&
      typeof parsed.amountFormatted === "string"
    ) {
      return {
        amount: parsed.amount,
        amountFormatted: parsed.amountFormatted,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function stringifyRelayAmountResult(result: RelayAmountResult): string {
  return JSON.stringify(result);
}

function findCurrencyAmountInDetails(
  quote: unknown,
  asset: DepositAsset,
): RelayAmountResult | null {
  const details = getQuoteDetails(quote);
  const currencyIn = details?.currencyIn;

  if (isRecord(currencyIn)) {
    const currency = currencyIn.currency;

    if (
      isRecord(currency) &&
      currency.symbol === asset &&
      typeof currencyIn.amount === "string"
    ) {
      return {
        amount: currencyIn.amount,
        amountFormatted:
          typeof currencyIn.amountFormatted === "string"
            ? currencyIn.amountFormatted
            : currencyIn.amount,
      };
    }
  }

  const fromNamedCurrencyIn = walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const currencyInValue = value.currencyIn;

    if (!isRecord(currencyInValue)) return null;

    const currency = currencyInValue.currency;

    if (
      isRecord(currency) &&
      currency.symbol === asset &&
      typeof currencyInValue.amount === "string"
    ) {
      return stringifyRelayAmountResult({
        amount: currencyInValue.amount,
        amountFormatted:
          typeof currencyInValue.amountFormatted === "string"
            ? currencyInValue.amountFormatted
            : currencyInValue.amount,
      });
    }

    return null;
  });

  if (fromNamedCurrencyIn) {
    const parsed = parseRelayAmountResult(fromNamedCurrencyIn);

    if (parsed) return parsed;
  }

  const fallback = walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const currency = value.currency;

    if (
      isRecord(currency) &&
      currency.symbol === asset &&
      typeof value.amount === "string"
    ) {
      return stringifyRelayAmountResult({
        amount: value.amount,
        amountFormatted:
          typeof value.amountFormatted === "string"
            ? value.amountFormatted
            : value.amount,
      });
    }

    return null;
  });

  return fallback ? parseRelayAmountResult(fallback) : null;
}

async function readRelayJson(response: Response): Promise<unknown> {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Relay returned non-JSON response. Status: ${response.status}. ${text.slice(
        0,
        160,
      )}`,
    );
  }
}

function getRelayErrorMessage(data: unknown, fallback: string): string {
  if (!isRecord(data)) return fallback;

  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;

  const error = data.error;

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

export async function createRelayDepositQuote({
  chain,
  destinationAmountAtomic,
}: {
  chain: DepositChain;
  destinationAmountAtomic: bigint;
}): Promise<RelayDepositQuote> {
  const origin = CHAIN_CONFIG[chain];
  const relayUserAddress = getRelayUserAddress(chain);
  const refundTo = getRelayRefundTo(chain);

  const body = {
    user: relayUserAddress,
    recipient: DESTINATION_CONFIG.recipient,

    originChainId: origin.relayChainId,
    originCurrency: origin.relayOriginCurrency,

    destinationChainId: DESTINATION_CONFIG.chainId,
    destinationCurrency: DESTINATION_CONFIG.currency,

    amount: destinationAmountAtomic.toString(),
    tradeType: "EXACT_OUTPUT",

    useDepositAddress: true,
    strict: true,
    refundTo,

    referrer: "edge",
  };

  console.log("[relay] quote request", {
    chain,
    originChainId: body.originChainId,
    originCurrency: body.originCurrency,
    destinationChainId: body.destinationChainId,
    destinationCurrency: body.destinationCurrency,
    user: body.user,
    recipient: body.recipient,
    amount: body.amount,
    tradeType: body.tradeType,
    strict: body.strict,
    useDepositAddress: body.useDepositAddress,
    refundTo: body.refundTo,
  });

  const response = await fetch(`${RELAY_API_BASE}/quote/v2`, {
    method: "POST",
    headers: relayHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const quote = await readRelayJson(response);

  if (!response.ok) {
    console.log("[relay] quote error", {
      chain,
      status: response.status,
      quote,
    });

    throw new Error(
      getRelayErrorMessage(
        quote,
        `Relay quote failed with status ${response.status}.`,
      ),
    );
  }

  const requestId = findRequestId(quote);
  const depositAddress = findDepositAddress(quote);
  const amountIn = findCurrencyAmountInDetails(quote, origin.asset);

  if (!requestId) {
    console.log("[relay] missing requestId", { chain, quote });

    throw new Error("Relay quote did not return a requestId.");
  }

  if (!depositAddress) {
    console.log("[relay] missing depositAddress", { chain, quote });

    throw new Error("Relay quote did not return a deposit address.");
  }

  if (!amountIn) {
    console.log("[relay] missing input amount", {
      chain,
      expectedAsset: origin.asset,
      quote,
    });

    throw new Error(
      `Relay quote did not return the required ${origin.asset} deposit amount.`,
    );
  }

  return {
    requestId,
    depositAddress,
    amountInAtomic: amountIn.amount,
    amountInDisplay: amountIn.amountFormatted,
    originChainId: origin.relayChainId,
    originCurrency: origin.relayOriginCurrency,
    destinationChainId: DESTINATION_CONFIG.chainId,
    destinationCurrency: DESTINATION_CONFIG.currency,
    quote,
  };
}

export async function getRelayIntentStatus(
  requestId: string,
): Promise<RelayStatusResponse> {
  const url = new URL(`${RELAY_API_BASE}/intents/status/v3`);
  url.searchParams.set("requestId", requestId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: relayHeaders(),
    cache: "no-store",
  });

  const data = await readRelayJson(response);

  if (!response.ok) {
    throw new Error(
      getRelayErrorMessage(
        data,
        `Relay status failed with status ${response.status}.`,
      ),
    );
  }

  if (!isRecord(data) || typeof data.status !== "string") {
    throw new Error("Relay status response did not include a status.");
  }

  return data as RelayStatusResponse;
}