import { Router, type IRouter } from "express";
import { requireClerkAuth } from "../lib/auth";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import suppliersRouter from "./suppliers";
import rfqRouter from "./rfq";
import usersRouter from "./users";
import reviewsRouter from "./reviews";
import dashboardRouter from "./dashboard";
import storageRouter, { storagePublicRouter } from "./storage";
import leadsRouter from "./leads";
import shopRouter from "./shop";

const router: IRouter = Router();

// Public catalog (homepage / browse) + health. Mutating routes keep requireClerkAuth.
router.use(healthRouter);
router.use(storagePublicRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(suppliersRouter);
router.use(reviewsRouter);
router.use(dashboardRouter);
router.use(shopRouter);

// Auth-gated areas
router.use(requireClerkAuth);
router.use(rfqRouter);
router.use(usersRouter);
router.use(storageRouter);
router.use(leadsRouter);

export default router;
