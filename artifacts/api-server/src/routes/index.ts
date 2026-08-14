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
import storageRouter from "./storage";
import leadsRouter from "./leads";
import shopRouter from "./shop";

const router: IRouter = Router();

// Uptime only — every other /api route requires a Clerk session.
router.use(healthRouter);
router.use(requireClerkAuth);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(suppliersRouter);
router.use(rfqRouter);
router.use(usersRouter);
router.use(reviewsRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(leadsRouter);
router.use(shopRouter);

export default router;
