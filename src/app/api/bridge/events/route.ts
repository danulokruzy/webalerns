import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { resolveBridgeClientByToken } from "@/server/bridge";
import { TASK_STATUS } from "@/server/domain";

const statusMap: Record<string, string> = {
  pending: TASK_STATUS.PENDING,
  running: TASK_STATUS.RUNNING,
  done: TASK_STATUS.DONE,
  failed: TASK_STATUS.FAILED,
  canceled: TASK_STATUS.CANCELED,
};

export async function POST(request: Request) {
  const token = request.headers.get("x-bridge-token");
  const client = await resolveBridgeClientByToken(token);
  if (!client) return fail("Недійсний bridge token.", 401);

  const body = (await request.json().catch(() => null)) as
    | { taskId?: string; status?: string; resultMessage?: string }
    | null;

  if (!body?.taskId || !body?.status || !statusMap[body.status]) {
    return fail("Некоректний payload bridge-події.", 400);
  }

  const task = await prisma.bridgeTask.update({
    where: { id: body.taskId },
    data: {
      status: statusMap[body.status],
      resultMessage: body.resultMessage?.trim() || null,
      executedAt: body.status === "done" ? new Date() : null,
      attempts: { increment: 1 },
    },
  });

  await prisma.bridgeClient.update({
    where: { id: client.id },
    data: { lastSeenAt: new Date() },
  });

  await prisma.eventLog.create({
    data: {
      type: "BRIDGE",
      message: `Bridge надіслав статус ${body.status} для задачі ${task.id}`,
      payloadJson: JSON.stringify({ taskId: task.id, clientId: client.id }),
    },
  });

  return ok(task);
}
