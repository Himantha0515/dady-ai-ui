import { catalogApi, paymentsApi } from "../api/catalog";
import { openRazorpayCheckout } from "./razorpayCheckout";

type Nav = (path: string) => void;

/** Opens Razorpay Standard Checkout for the cheapest active credit pack (Mini Pack). */
export async function startCreditPackCheckout(opts: {
  email?: string | null;
  navigate: Nav;
  creditPackId?: string;
}) {
  const packs = await catalogApi.listCreditPacks();
  const pack = opts.creditPackId
    ? packs.find((p) => p.id === opts.creditPackId)
    : packs[0];

  if (!pack) {
    throw new Error("No credit pack available");
  }

  const order = (await paymentsApi.createOrder(pack.id, crypto.randomUUID())) as {
    orderId: string;
    razorpayOrderId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
    mock?: boolean;
  };

  if (order.mock || order.razorpayOrderId.startsWith("order_mock_")) {
    opts.navigate(`/billing/processing?order_id=${order.orderId}&mock=1`);
    return;
  }

  await openRazorpayCheckout({
    keyId: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
    orderId: order.razorpayOrderId,
    amountPaise: order.amountPaise,
    currency: order.currency,
    description: `${pack.name} · ${pack.credits} credits`,
    email: opts.email,
    onSuccess: () => {
      opts.navigate(`/billing/processing?order_id=${order.orderId}`);
    },
    onDismiss: () => {
      opts.navigate(`/billing/failed?order_id=${order.orderId}`);
    },
  });
}
