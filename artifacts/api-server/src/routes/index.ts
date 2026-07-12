import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import suppliersRouter from "./suppliers";
import rfqRouter from "./rfq";
import usersRouter from "./users";
import reviewsRouter from "./reviews";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(suppliersRouter);
router.use(rfqRouter);
router.use(usersRouter);
router.use(reviewsRouter);
router.use(dashboardRouter);
router.use(storageRouter);

export default router;
