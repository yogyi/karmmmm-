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
router.use(storagePublicRouter); // Blob webhook + ACL-gated object GET only
router.use(categoriesRouter);
router.use(productsRouter); // public GETs; POST/PATCH/DELETE use requireClerkAuth
router.use(suppliersRouter); // public GETs; mutations /me /approve use requireClerkAuth
router.use(reviewsRouter); // public GET; POST uses requireClerkAuth
router.use(dashboardRouter); // public aggregates; supplier dash uses requireClerkAuth
router.use(shopRouter); // public plans; setup/subscription use requireClerkAuth

// Auth-gated areas (defense in depth — routes also re-check Clerk)
router.use(requireClerkAuth);
router.use(rfqRouter);
router.use(usersRouter);
router.use(storageRouter);
router.use(leadsRouter);

export default router;
