import mongoose from "mongoose";
const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },

    interviewCoins: {
      type: Number,
      required: true,
    },

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },

    // Set once auth-service confirms the credit. A payment that is "paid" but
    // false here is money taken without coins delivered — worth alerting on.
    coinsCredited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;