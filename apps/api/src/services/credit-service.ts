import { prisma } from "../lib/prisma";
import { config } from "../config";

export function getCost(durationSeconds: number): number {
  return config.creditCosts[durationSeconds] ?? 2;
}

/**
 * Atomically reserve credits (debit balance once). Idempotent.
 */
export async function reserveCredits(userId: string, amount: number, generationId: string) {
  return prisma.$transaction(async (tx) => {
    const gen = await tx.videoGeneration.findUnique({ where: { id: generationId } });
    if (!gen) throw Object.assign(new Error("Génération introuvable"), { status: 404 });
    if (gen.creditStatus === "reserved" || gen.creditStatus === "charged") {
      return; // already reserved – idempotent
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error("Utilisateur introuvable"), { status: 404 });
    if (user.credits < amount) {
      throw Object.assign(new Error("Crédits insuffisants"), { status: 402 });
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: amount } },
    });

    await tx.videoGeneration.update({
      where: { id: generationId },
      data: { creditStatus: "reserved", creditsUsed: amount },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        generationId,
        type: "reservation",
        amount: -amount,
        balanceAfter: updated.credits,
        description: `Réservation génération ${generationId}`,
      },
    });

    return updated.credits;
  });
}

/**
 * Confirm reservation after success. Does NOT debit again.
 * amount in ledger is 0 so history does not look like a second charge.
 */
export async function chargeCredits(userId: string, amount: number, generationId: string) {
  return prisma.$transaction(async (tx) => {
    const gen = await tx.videoGeneration.findUnique({ where: { id: generationId } });
    if (!gen) return;
    if (gen.creditStatus === "charged") return;
    if (gen.creditStatus === "refunded") return;
    if (gen.creditStatus !== "reserved") return;

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return;

    await tx.videoGeneration.update({
      where: { id: generationId },
      data: { creditStatus: "charged" },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        generationId,
        type: "confirmation",
        amount: 0, // no second debit – reservation already decreased balance
        balanceAfter: user.credits,
        description: `Confirmation débit génération ${generationId} (${amount} crédits)`,
      },
    });
  });
}

/**
 * Refund reserved credits on failure/cancel. Idempotent.
 */
export async function refundCredits(userId: string, amount: number, generationId: string) {
  return prisma.$transaction(async (tx) => {
    const gen = await tx.videoGeneration.findUnique({ where: { id: generationId } });
    if (!gen) return;
    if (gen.creditStatus === "refunded") return;
    if (gen.creditStatus === "charged") return;
    if (gen.creditStatus !== "reserved") return;

    const updated = await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });

    await tx.videoGeneration.update({
      where: { id: generationId },
      data: { creditStatus: "refunded" },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        generationId,
        type: "refund",
        amount,
        balanceAfter: updated.credits,
        description: `Remboursement génération ${generationId}`,
      },
    });

    return updated.credits;
  });
}
