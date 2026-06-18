import {
  CHAIN_CONFIG,
  DESTINATION_CONFIG,
  type DepositAsset,
  type DepositChain,
  type DestinationAsset,
  getRelayRefundTo,
  getRelayUserAddress,
  usdcAtomicToDisplay,
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

  quotedAmountOutAtomic: string;
  quotedAmountOutDisplay: string;

  originChainId: number;
  originCurrency: string;
  destinationChainId: number;
  destinationCurrency: string;

  tradeType: "EXPECTED_OUTPUT";
  strict: false;

  quote: unknown;
};

const RELAY_API_BASE = process.env.RELAY_API_BASE ?? "https://api.relay.link";

function relayHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
      const found = walk(item, visitor);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      const found = walk(item, visitor);

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

    const direct =
      readString(value.depositAddress) ??
      readString(value.deposit_address) ??
      readString(value.address);

    if (direct && direct.length > 8) {
      return direct;
    }

    const depositAddress = value.depositAddress;

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

    return (
      readString(value.requestId) ??
      readString(value.request_id) ??
      readString(value.id)
    );
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

function getCurrencySymbol(value: unknown) {
  if (!isRecord(value)) return null;

  const currency = value.currency;

  if (isRecord(currency)) {
    return readString(currency.symbol);
  }

  return readString(value.symbol);
}

function getAmountFromCurrencyObject(value: unknown): RelayAmountResult | null {
  if (!isRecord(value)) return null;

  const amount =
    readString(value.amount) ??
    readString(value.amountAtomic) ??
    readString(value.amount_atomic) ??
    readString(value.rawAmount);

  const amountFormatted =
    readString(value.amountFormatted) ??
    readString(value.amount_formatted) ??
    readString(value.amountDisplay) ??
    readString(value.amount_display) ??
    amount;

  if (!amount || !amountFormatted) return null;

  return {
    amount,
    amountFormatted,
  };
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

    const symbol = getCurrencySymbol(currencyInValue);
    const amount = getAmountFromCurrencyObject(currencyInValue);

    if (symbol === asset && amount) {
      return stringifyRelayAmountResult(amount);
    }

    return null;
  });

  if (fromNamedCurrencyIn) {
    const parsed = parseRelayAmountResult(fromNamedCurrencyIn);

    if (parsed) return parsed;
  }

  const fallback = walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const symbol = getCurrencySymbol(value);
    const amount = getAmountFromCurrencyObject(value);

    if (symbol === asset && amount) {
      return stringifyRelayAmountResult(amount);
    }

    return null;
  });

  return fallback ? parseRelayAmountResult(fallback) : null;
}

function findCurrencyAmountOutDetails(
  quote: unknown,
  asset: DestinationAsset,
): RelayAmountResult | null {
  const details = getQuoteDetails(quote);
  const currencyOut = details?.currencyOut;

  if (isRecord(currencyOut)) {
    const currency = currencyOut.currency;

    if (
      isRecord(currency) &&
      currency.symbol === asset &&
      typeof currencyOut.amount === "string"
    ) {
      return {
        amount: currencyOut.amount,
        amountFormatted:
          typeof currencyOut.amountFormatted === "string"
            ? currencyOut.amountFormatted
            : currencyOut.amount,
      };
    }
  }

  const fromNamedCurrencyOut = walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const currencyOutValue = value.currencyOut;

    if (!isRecord(currencyOutValue)) return null;

    const symbol = getCurrencySymbol(currencyOutValue);
    const amount = getAmountFromCurrencyObject(currencyOutValue);

    if (symbol === asset && amount) {
      return stringifyRelayAmountResult(amount);
    }

    return null;
  });

  if (fromNamedCurrencyOut) {
    const parsed = parseRelayAmountResult(fromNamedCurrencyOut);

    if (parsed) return parsed;
  }

  const fallback = walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const symbol = getCurrencySymbol(value);
    const amount = getAmountFromCurrencyObject(value);

    if (symbol === asset && amount) {
      return stringifyRelayAmountResult(amount);
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
    tradeType: "EXPECTED_OUTPUT",

    useDepositAddress: true,
    strict: false,
    refundTo,

    referrer: "edge",
  } as const;

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
  const amountOut = findCurrencyAmountOutDetails(
    quote,
    DESTINATION_CONFIG.asset,
  );

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

    quotedAmountOutAtomic: amountOut?.amount ?? destinationAmountAtomic.toString(),
    quotedAmountOutDisplay:
      amountOut?.amountFormatted ?? usdcAtomicToDisplay(destinationAmountAtomic),

    originChainId: origin.relayChainId,
    originCurrency: origin.relayOriginCurrency,
    destinationChainId: DESTINATION_CONFIG.chainId,
    destinationCurrency: DESTINATION_CONFIG.currency,

    tradeType: body.tradeType,
    strict: body.strict,

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