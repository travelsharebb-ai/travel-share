import { describe, expect, it } from "vitest";
import { getPaymentReadiness } from "../../src/utils/payments.js";

describe("payment provider readiness", () => {
  it("requires both Stripe checkout and webhook secrets", () => {
    expect(getPaymentReadiness({ PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_test" }).paymentsReady).toBe(false);
    expect(getPaymentReadiness({ PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec_test" }).paymentsReady).toBe(true);
  });

  it("keeps PayPal disabled until verified webhook handling is implemented", () => {
    const status = getPaymentReadiness({ PAYMENT_PROVIDER: "paypal", PAYPAL_ENABLED: "true", PAYPAL_CLIENT_ID: "client", PAYPAL_CLIENT_SECRET: "secret", PAYPAL_WEBHOOK_ID: "webhook" });
    expect(status.paypalConfigured).toBe(true);
    expect(status.paypalWebhookConfigured).toBe(false);
    expect(status.paymentsReady).toBe(false);
  });
});
