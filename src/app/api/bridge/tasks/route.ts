import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { resolveBridgeClientByToken } from "@/server/bridge";
import { TASK_STATUS } from "@/server/domain";

export async function GET(request: Request) {
  const token = request.headers.get("x-bridge-token");
  const client = await resolveBridgeClientByToken(token);
  if (!client) return fail("Недійсний bridge token.", 401);

  await prisma.bridgeClient.update({
    where: { id: client.id },
    data: { lastSeenAt: new Date() },
  });

  const limit = 1;
  const tasks = await prisma.bridgeTask.findMany({
    where: {
      status: TASK_STATUS.PENDING,
      runAt: { lte: new Date() },
      OR: [{ clientId: null }, { clientId: client.id }],
    },
    orderBy: { runAt: "asc" },
    take: limit,
  });

  if (tasks.length > 0) {
    await prisma.bridgeTask.updateMany({
      where: { id: { in: tasks.map((task) => task.id) } },
      data: { status: TASK_STATUS.RUNNING, clientId: client.id },
    });
  }

  return ok(tasks);
}
