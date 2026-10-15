import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/async-handler";

const router = Router();

router.get("/", requireAuth, ah(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { credits: true },
  });
  res.json({ credits: user?.credits ?? 0 });
}));

router.get("/transactions", requireAuth, ah(async (req, res) => {
  const txs = await prisma.creditTransaction.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      description: true,
      generationId: true,
      createdAt: true,
    },
  });
  res.json({ transactions: txs });
}));

export default router;
