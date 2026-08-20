// Guards endpoints that may only be called by another service, never by a
// browser. Coin crediting lives behind this: previously any logged-in user
// could POST /api/auth/add-coins with any amount and grant themselves coins
// without paying, which made the Razorpay signature check pointless.
export const internalOnly = (req, res, next) => {
  const expected = process.env.INTERNAL_API_SECRET;

  // Fail closed. A missing secret in config must not mean "allow everyone".
  if (!expected) {
    console.error("INTERNAL_API_SECRET is not set — refusing internal request");
    return res.status(503).json({
      success: false,
      message: "Service not configured",
    });
  }

  const provided = req.headers["x-internal-secret"];

  if (!provided || provided !== expected) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  next();
};

export default internalOnly;
