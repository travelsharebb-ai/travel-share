function appUrl(path) {
  return new URL(path, process.env.FRONTEND_URL || "http://localhost:5173").toString();
}

export function getPaymentCurrency() {
  return String(process.env.STRIPE_CURRENCY || "usd").toLowerCase();
}

export async function createStripeCheckout({ item, user, transaction }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
    error.status = 501;
    throw error;
  }

  const metadata = {
    userId: user.id,
    itemId: item.id,
    provider: "stripe"
  };
  if (transaction?.id) metadata.transactionId = transaction.id;

  const body = new URLSearchParams({
    mode: "payment",
    success_url: appUrl("/store?payment=success"),
    cancel_url: appUrl("/store?payment=cancel"),
    customer_email: user.email,
    client_reference_id: `${user.id}:${item.id}`,
    "line_items[0][quantity]": "1"
  });

  Object.entries(metadata).forEach(([key, value]) => {
    body.set(`metadata[${key}]`, value);
    body.set(`payment_intent_data[metadata][${key}]`, value);
  });

  if (item.metadata?.stripePriceId) {
    body.set("line_items[0][price]", item.metadata.stripePriceId);
  } else {
    body.set("line_items[0][price_data][currency]", getPaymentCurrency());
    body.set("line_items[0][price_data][unit_amount]", String(item.priceCents));
    body.set("line_items[0][price_data][product_data][name]", item.name);
    if (item.description) {
      body.set("line_items[0][price_data][product_data][description]", item.description);
    }
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "Stripe checkout failed.");
    error.status = 502;
    throw error;
  }
  return {
    providerRef: data.id,
    checkoutUrl: data.url,
    rawResponse: data,
    currency: data.currency || getPaymentCurrency(),
    providerPaymentId: typeof data.payment_intent === "string" ? data.payment_intent : null
  };
}

async function paypalAccessToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    const error = new Error("PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
    error.status = 501;
    throw error;
  }

  const base = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || "PayPal token request failed.");
    error.status = 502;
    throw error;
  }
  return data.access_token;
}

export async function createPaypalOrder({ item }) {
  const base = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
  const token = await paypalAccessToken();
  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "USD", value: (item.priceCents / 100).toFixed(2) },
        description: item.name
      }],
      application_context: {
        return_url: appUrl("/store?payment=success"),
        cancel_url: appUrl("/store?payment=cancel")
      }
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "PayPal order creation failed.");
    error.status = 502;
    throw error;
  }
  return {
    providerRef: data.id,
    checkoutUrl: data.links?.find((link) => link.rel === "approve")?.href,
    rawResponse: data
  };
}

export async function verifyStripeCheckout(sessionId) {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
    error.status = 501;
    throw error;
  }
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "Stripe verification failed.");
    error.status = 502;
    throw error;
  }
  return {
    paid: data.payment_status === "paid",
    status: data.status,
    rawResponse: data,
    currency: data.currency || getPaymentCurrency(),
    providerPaymentId: typeof data.payment_intent === "string" ? data.payment_intent : null
  };
}

export async function capturePaypalOrder(orderId) {
  const base = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
  const token = await paypalAccessToken();
  const response = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "PayPal capture failed.");
    error.status = 502;
    throw error;
  }
  return { paid: data.status === "COMPLETED", rawResponse: data };
}
