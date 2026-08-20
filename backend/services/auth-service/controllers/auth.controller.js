import crypto from "crypto";

import { getAuth } from "firebase-admin/auth";


import { app } from "../configs/firebase.js";
import User from "../model/user.model.js";
import  redis from "../../../shared/redis/redis.js";
import { saveSession, refreshUserSessions } from "../utils/session.js";


export const login = async (req, res) => {

  try {

    const { token } = req.body;

    const decoded = await getAuth(app).verifyIdToken(token);

    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    if (!user) {

      user = await User.create({

        firebaseUid: decoded.uid,

        email: decoded.email,

        name: decoded.name

      });

    }

    const sessionId =crypto.randomUUID();

    await saveSession(sessionId, user);

    res.cookie( "session", sessionId,{
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge:1000 * 60 * 60 * 24 * 7,
      }
    );

    return res.json({ success:true,user});

  } catch (error) {

    return res.status(401).json({ message: error.message, });

  }

};

export const devLogin = async (req, res) => {

  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEV_LOGIN !== "true"
  ) {

    return res.status(404).json({
      message: "Not found",
    });

  }

  try {

    let user = await User.findOne({
      firebaseUid: "dev-guest",
    });

    if (!user) {

      user = await User.create({

        firebaseUid: "dev-guest",

        email: "guest@dev.local",

        name: "Dev Guest"

      });

    }

    const sessionId = crypto.randomUUID();

    await saveSession(sessionId, user);

    res.cookie( "session", sessionId,{
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge:1000 * 60 * 60 * 24 * 7,
      }
    );

    return res.json({ success:true,user});

  } catch (error) {

    return res.status(500).json({ message: error.message, });

  }

};

export const logout = async (req, res) => {
  try {

    const sessionId = req.cookies?.session;

    if (sessionId) {
      await redis.del(`session:${sessionId}`);
    }

    res.clearCookie("session", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};
export const useInterviewCoins = async (req, res) => {
  try {
const sessionId = req.cookies?.session;

  const session = await redis.get(`session:${sessionId}`)

  const sessionData = JSON.parse(session);

    const { coins, action } = req.body;

    if (!coins) {
      return res.status(400).json({
        success: false,
        message: "Coins are required",
      });
    }

    const user = await User.findById(sessionData.userId);

    // Dev testing: never run the guest account out of coins. Same gate as
    // /dev-login, so this can't be reached in production.
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_DEV_LOGIN === "true" &&
      user?.firebaseUid === "dev-guest"
    ) {
      return res.status(200).json({
        success: true,
        message: "Interview coins updated successfully",
        action,
        interviewCoin: user.interviewCoin,
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Not enough coins
    if (user.interviewCoin < coins) {
      return res.status(403).json({
        success: false,
        message: "Not enough interview coins",
        interviewCoin: user.interviewCoin,
      });
    }

    // Deduct coins
    user.interviewCoin -= coins;

    await user.save();
    await saveSession(sessionId, user);


    return res.status(200).json({
      success: true,
      message: "Interview coins updated successfully",
      action,
      interviewCoin: user.interviewCoin,
    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};




/**
 * Credit coins to a user. INTERNAL ONLY — see middlewares/internalOnly.js.
 *
 * This used to be reachable from the browser and took both the amount and the
 * caller's identity from the request, so any signed-in user could award
 * themselves unlimited coins without paying. The route is now behind a shared
 * secret and the caller (billing-service) passes a userId it read from a
 * payment record whose Razorpay signature it already verified.
 */
export const addCoins = async (req, res) => {
  try {
    const { userId, coins } = req.body || {};

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const amount = Number(coins);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid coins are required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.interviewCoin += amount;

    await user.save();

    // Push the new balance into every live session for this user, since the
    // caller is another service and has no access to their cookie.
    await refreshUserSessions(user);

    return res.status(200).json({
      success: true,
      message: "Coins added successfully",
      interviewCoin: user.interviewCoin,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};