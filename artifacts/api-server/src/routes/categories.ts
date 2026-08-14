import { Router, type IRouter } from "express";
import { prisma } from "@workspace/db";
import { ListCategoriesResponse } from "@workspace/api-zod";
import { requireClerkAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/categories", requireClerkAuth, async (_req, res): Promise<void> => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  res.json(ListCategoriesResponse.parse(categories));
});

export default router;
