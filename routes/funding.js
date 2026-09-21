const express = require("express");
const stripe = require("../config/stripe");
const { funding } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const records = await funding
      .find({ status: "paid" })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Failed to fetch funding records:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load funding records",
    });
  }
});

router.post("/create-checkout-session", async (req, res) => {
  const { name, amount } = req.body || {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Name is required.",
    });
  }

  const amountNumber = Number(amount);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid funding amount.",
    });
  }

  const amountInCents = Math.round(amountNumber * 100);

  if (amountInCents < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid funding amount.",
    });
  }

  try {
    const clientUrl =
      process.env.CLIENT_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "BloodBridge Community Fund",
              description: "Community support contribution to BloodBridge",
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        donorName: name.trim(),
      },
      success_url: `${clientUrl}/funding?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/funding?payment=cancelled`,
    });

    try {
      await funding.insertOne({
        name: name.trim(),
        amount: amountNumber,
        currency: "usd",
        stripeSessionId: session.id,
        paymentIntentId: null,
        status: "pending",
        createdAt: new Date(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        const existingFunding = await funding.findOne({
          stripeSessionId: session.id,
        });

        if (existingFunding) {
          return res.status(200).json({
            success: true,
            url: session.url,
          });
        }
      }

      throw error;
    }

    return res.status(200).json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error("Failed to create Stripe checkout session:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create checkout session.",
    });
  }
});

router.get("/verify-session", (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Checkout session ID is required.",
  });
});

router.get("/verify-session/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId?.trim();

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: "Checkout session ID is required.",
    });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const fundingRecord = await funding.findOne({
      stripeSessionId: sessionId,
    });

    if (!fundingRecord) {
      return res.status(404).json({
        success: false,
        message: "Funding record not found",
      });
    }

    if (fundingRecord.status === "paid") {
      return res.status(200).json({
        success: true,
        paid: true,
        status: "paid",
      });
    }

    if (session.payment_status !== "paid") {
      return res.status(200).json({
        success: true,
        paid: false,
        status: fundingRecord.status || "pending",
      });
    }

    await funding.updateOne(
      { _id: fundingRecord._id, status: { $ne: "paid" } },
      {
        $set: {
          status: "paid",
          paymentIntentId: session.payment_intent || null,
        },
      }
    );

    return res.status(200).json({
      success: true,
      paid: true,
      status: "paid",
    });
  } catch (error) {
    if (
      error?.type === "StripeInvalidRequestError" ||
      error?.code === "resource_missing"
    ) {
      return res.status(404).json({
        success: false,
        message: "Checkout session not found.",
      });
    }

    console.error("Failed to verify Stripe checkout session:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify checkout session.",
    });
  }
});

module.exports = router;
