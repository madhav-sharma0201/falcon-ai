import express from "express";
import { createOrder, verifyPayment } from "../controllers/billing.controller.js";



const paymentRouter = express.Router();


paymentRouter.post("/create", createOrder)
paymentRouter.post("/verify",  verifyPayment)


export default paymentRouter;
