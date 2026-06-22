import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const currency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

const catalog = [
  {
    key: "image_skin",
    name: "TravelShare Image Skin",
    type: "image_skin",
    priceCents: 499,
    description: "A premium visual skin for TravelShare albums and memory pages."
  },
  {
    key: "photo_frame",
    name: "TravelShare Photo Frame",
    type: "photo_frame",
    priceCents: 499,
    description: "A premium frame style for shared photos and albums."
  },
  {
    key: "album_theme",
    name: "TravelShare Album Theme",
    type: "album_theme",
    priceCents: 999,
    description: "A premium album theme for trip memory collections."
  },
  {
    key: "event_theme",
    name: "TravelShare Event Theme",
    type: "event_theme",
    priceCents: 1499,
    description: "A premium visual theme for event albums and public event pages."
  },
  {
    key: "download_asset",
    name: "TravelShare Download Pass",
    type: "download_asset",
    priceCents: 399,
    description: "Paid access to downloadable event or trip media assets."
  },
  {
    key: "premium_qr",
    name: "TravelShare Premium QR Style",
    type: "premium_qr",
    priceCents: 799,
    description: "Premium QR styling for trip, event, and upload collection pages."
  },
  {
    key: "branded_page",
    name: "TravelShare Branded Page",
    type: "branded_page",
    priceCents: 2999,
    description: "A branded TravelShare page treatment for organizers and venues."
  },
  {
    key: "ad_free",
    name: "TravelShare Ad-Free Viewing",
    type: "ad_free",
    priceCents: 999,
    description: "Remove sponsored placements from supported TravelShare viewing surfaces."
  }
];

function requireStripeSecret() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Set STRIPE_SECRET_KEY before running this script.");
  }
}

function params(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") body.set(key, String(value));
  }
  return body;
}

async function stripeRequest(path, { method = "GET", body, idempotencyKey } = {}) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Stripe request failed: ${method} ${path}`);
  }
  return data;
}

async function findProduct(key) {
  for (const active of [true, false]) {
    const data = await stripeRequest(`/products?limit=100&active=${active}`);
    const product = data.data.find((entry) => entry.metadata?.travelshare_key === key);
    if (product) return product;
  }
  return null;
}

async function upsertProduct(item) {
  const existing = await findProduct(item.key);
  const body = params({
    name: item.name,
    description: item.description,
    active: true,
    "metadata[travelshare_key]": item.key,
    "metadata[travelshare_type]": item.type
  });

  if (existing) {
    return stripeRequest(`/products/${existing.id}`, { method: "POST", body });
  }

  return stripeRequest("/products", {
    method: "POST",
    body,
    idempotencyKey: `travelshare-product-${item.key}`
  });
}

async function findPrice(lookupKey) {
  const encoded = encodeURIComponent(lookupKey);
  const data = await stripeRequest(`/prices?active=true&limit=1&lookup_keys[]=${encoded}`);
  return data.data[0] || null;
}

async function upsertPrice(item, productId) {
  const lookupKey = `travelshare_${item.key}_${currency}_${item.priceCents}`;
  const existing = await findPrice(lookupKey);
  if (existing) return { price: existing, lookupKey };

  const body = params({
    currency,
    unit_amount: item.priceCents,
    product: productId,
    lookup_key: lookupKey,
    "metadata[travelshare_key]": item.key,
    "metadata[travelshare_type]": item.type
  });

  const price = await stripeRequest("/prices", {
    method: "POST",
    body,
    idempotencyKey: `travelshare-price-${lookupKey}`
  });

  return { price, lookupKey };
}

async function upsertStoreItem(item, product, price, lookupKey) {
  const metadata = {
    stripeProductId: product.id,
    stripePriceId: price.id,
    stripeLookupKey: lookupKey,
    stripeCurrency: currency,
    travelshareKey: item.key
  };

  const existing = await prisma.purchaseItem.findFirst({
    where: {
      OR: [
        { metadata: { path: ["travelshareKey"], equals: item.key } },
        { metadata: { path: ["stripePriceId"], equals: price.id } },
        { name: item.name }
      ]
    }
  });

  const data = {
    name: item.name,
    description: item.description,
    type: item.type,
    priceCents: item.priceCents,
    active: true,
    metadata
  };

  if (existing) {
    return prisma.purchaseItem.update({ where: { id: existing.id }, data });
  }

  return prisma.purchaseItem.create({ data });
}

async function main() {
  requireStripeSecret();
  const results = [];

  for (const item of catalog) {
    const product = await upsertProduct(item);
    const { price, lookupKey } = await upsertPrice(item, product.id);
    const storeItem = await upsertStoreItem(item, product, price, lookupKey);
    results.push({
      key: item.key,
      storeItemId: storeItem.id,
      productId: product.id,
      priceId: price.id,
      amount: item.priceCents
    });
  }

  console.table(results);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
