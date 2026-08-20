import express from "express";
import {addCoins, devLogin, login, logout, useInterviewCoins } from "../controllers/auth.controller.js";
import { internalOnly } from "../middlewares/internalOnly.js";




const authRouter = express.Router();

authRouter.post("/login",login);

authRouter.post("/dev-login",devLogin);

authRouter.get("/logout",logout)

// Service-to-service only. Coins are credited by billing-service after it has
// verified the Razorpay signature — never directly by the browser.
authRouter.post("/add-coins", internalOnly, addCoins)

authRouter.post(
  "/use-interview-coins",
  useInterviewCoins
);

export default authRouter;