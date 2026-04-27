import { randomBytes } from "node:crypto";
import { prisma } from "@/server/prisma";
import { hashToken } from "@/server/auth";

export async function resolveBridgeClientByToken(token?: string | null) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  return prisma.bridgeClient.findFirst({
    where: { tokenHash, enabled: true },
  });
}

export async function ensurePrimaryBridgeClient() {
  const existing = await prisma.bridgeClient.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return { client: existing, token: null as string | null };

  const token = randomBytes(24).toString("hex");
  const client = await prisma.bridgeClient.create({
    data: {
      machineName: "bridge-local",
      tokenHash: hashToken(token),
      enabled: true,
    },
  });
  return { client, token };
}

export async function rotateBridgeToken(clientId: string) {
  const token = randomBytes(24).toString("hex");
  const updated = await prisma.bridgeClient.update({
    where: { id: clientId },
    data: { tokenHash: hashToken(token) },
  });
  return { client: updated, token };
}
