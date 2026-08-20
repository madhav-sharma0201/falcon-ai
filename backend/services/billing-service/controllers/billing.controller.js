import crypto from "crypto";
import razorpay from "../configs/razorpay.js";
import Payment from "../models/billing.model.js";






const PLANS = {
  starter: {
    amount: 199,
    interviewCoins: 300,
  },
};

export const createOrder = async (req, res) => {
  try {
    const { planId } = req.body;
     const userId = req.headers["x-user-id"];

    const plan = PLANS[planId];

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }


    const order = await razorpay.orders.create({
      amount: plan.amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    await Payment.create({
      userId,
      planId,
      amount: plan.amount,
      interviewCoins: plan.interviewCoins,
      razorpayOrderId: order.id,
      status: "created",
    });

    return res.status(201).json({
      success: true,
      order,
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
};


export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {

      payment.status = "failed";
      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    if (payment.status === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
      });
    }

    payment.status = "paid";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;

    await payment.save();

    // -----------------------------------
    // Credit the coins — server side
    // -----------------------------------
    // The amount comes from the stored plan on the payment record, not from
    // the client, and this only runs after the Razorpay signature matched.
    // The `status === "paid"` guard above makes it idempotent, so replaying
    // the same verify call cannot credit twice.
    let interviewCoin = null;

    try {
      const creditRes = await fetch(
        `${process.env.AUTH_SERVICE_URL}/add-coins`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.INTERNAL_API_SECRET,
          },
          body: JSON.stringify({
            userId: payment.userId,
            coins: payment.interviewCoins,
          }),
        }
      );

      const credit = await creditRes.json();

      if (!creditRes.ok || !credit.success) {
        throw new Error(credit?.message || `auth-service responded ${creditRes.status}`);
      }

      interviewCoin = credit.interviewCoin;

      payment.coinsCredited = true;
      await payment.save();

    } catch (creditError) {
      // The money is taken and the payment is verified, so this must not look
      // like a failed payment. Flag it loudly for manual reconciliation.
      console.error(
        `PAYMENT ${payment._id} VERIFIED BUT COINS NOT CREDITED for user ${payment.userId}:`,
        creditError.message
      );

      return res.status(200).json({
        success: true,
        message:
          "Payment successful, but your coins are still being added. They will appear shortly — contact support if they don't.",
        coinsCredited: false,
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment successful",
      coinsCredited: true,
      interviewCoin,
    });

  } catch (error) {
    console.log(error);

    if (req.body?.razorpay_order_id) {
      await Payment.findOneAndUpdate(
        {
          razorpayOrderId: req.body.razorpay_order_id,
        },
        {
          status: "failed",
        }
      );
    }

    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};