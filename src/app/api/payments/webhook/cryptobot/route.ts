import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ensureBootstrap } from "@/server/bootstrap";
import { fail, ok } from "@/server/http";
import { verifyDonation } from "@/server/payments/checks";
import { prisma } from "@/server/prisma";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AnyRecord;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pickString(candidates: AnyRecord[], keys: string[]) {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = asString(candidate[key]);
      if (value) return value;
    }
  }
  return undefined;
}

function pickNumber(candidates: AnyRecord[], keys: string[]) {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = asNumber(candidate[key]);
      if (value != null) return value;
    }
  }
  return undefined;
}

function parseWebhookPayload(raw: unknown) {
  const root = asRecord(raw);
  if (!root) {
    return null;
  }

  const nested = [
    asRecord(root.event),
    asRecord(root.payload),
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.update),
    asRecord(root.invoice),
  ].filter(Boolean) as AnyRecord[];

  const candidates = [root, ...nested];
  const statusRaw =
    pickString(candidates, ["status", "invoice_status", "payment_status", "state"])?.toLowerCase() ??
    "";
  const isPaid = ["paid", "completed", "success", "succeeded", "confirmed"].includes(statusRaw);

  const checkId = pickString(candidates, ["checkId", "check_id", "orderId", "order_id"]);
  const comment = pickString(candidates, [
    "comment",
    "description",
    "payload",
    "invoice_payload",
    "hidden_message",
    "message",
  ]);
  const txHash = pickString(candidates, [
    "txHash",
    "tx_hash",
    "transaction_hash",
    "transactionRef",
    "transaction_ref",
    "hash",
    "transfer_id",
    "id",
  ]);
  const paidAmount = pickNumber(candidates, [
    "amount",
    "amount_paid",
    "asset_amount",
    "usdt_amount",
    "total",
    "sum",
  ]);

  return {
    isPaid,
    statusRaw,
    checkId,
    comment,
    txHash,
    paidAmount,
    raw: root,
  };
}

async function getCryptobotToken(): Promise<string> {
  const connection = await prisma.connection.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { cryptobotToken: true },
  });
  return connection?.cryptobotToken?.trim() || "";
}

function verifyCryptobotSignature(
  apiToken: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  if (!apiToken || !signatureHeader) return false;
  const secret = createHash("sha256").update(apiToken).digest();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signatureHeader, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  await ensureBootstrap();

  const rawBody = await request.text().catch(() => "");
  const signatureHeader = request.headers.get("crypto-pay-api-signature") || "";

  const apiToken = await getCryptobotToken();
  if (apiToken && signatureHeader) {
    if (!verifyCryptobotSignature(apiToken, rawBody, signatureHeader)) {
      await prisma.eventLog.create({
        data: {
          type: "PAYMENT",
          message: "CryptoBot webhook: невірний підпис. Запит відхилено.",
        },
      });
      return fail("Невірний підпис webhook.", 403);
    }
  } else if (apiToken && !signatureHeader) {
    await prisma.eventLog.create({
      data: {
        type: "PAYMENT",
        message: "CryptoBot webhook: відсутній заголовок підпису.",
      },
    });
    return fail("Відсутній підпис webhook.", 403);
  }

  const body = rawBody ? JSON.parse(rawBody) : null;
  const payload = parseWebhookPayload(body);

  if (!payload) {
    return fail("Некоректний payload webhook.", 400);
  }

  if (!payload.isPaid) {
    await prisma.eventLog.create({
      data: {
        type: "PAYMENT",
        message: "CryptoBot webhook отримано, але платіж ще не завершений.",
        payloadJson: JSON.stringify({
          status: payload.statusRaw || "unknown",
          body: payload.raw,
        }),
      },
    });
    return ok({ received: true, paid: false });
  }

  const result = await verifyDonation({
    checkId: payload.checkId,
    channel: "cryptobot",
    comment: payload.comment,
    txHash: payload.txHash,
    paidAmount: payload.paidAmount,
    verifyOnly: false,
    allowAnonymousOnFail: false,
  });

  await prisma.eventLog.create({
    data: {
      type: "PAYMENT",
      message: "CryptoBot webhook оброблено.",
      payloadJson: JSON.stringify({
        status: result.status,
        checkId: payload.checkId || null,
        txHash: payload.txHash || null,
      }),
    },
  });

  return ok({ received: true, paid: true, result });
}
