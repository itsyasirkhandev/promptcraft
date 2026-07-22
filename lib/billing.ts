const polarProductId = process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID;

if (!polarProductId) {
  throw new Error("Missing NEXT_PUBLIC_POLAR_PRODUCT_ID");
}

export const POLAR_PRODUCT_ID = polarProductId;
