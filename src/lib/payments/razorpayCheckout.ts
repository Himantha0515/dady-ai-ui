type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount?: number;
  currency?: string;
  name: string;
  description?: string;
  order_id?: string;
  subscription_id?: string;
  handler: (response: RazorpaySuccess) => void;
  prefill?: { email?: string; name?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
  /** Preferred methods for Indian checkout (UPI QR, cards, netbanking). */
  method?: Record<string, boolean>;
  config?: Record<string, unknown>;
  remember_customer?: boolean;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on?: (event: string, cb: (err: unknown) => void) => void;
    };
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function openCheckout(options: RazorpayOptions) {
  const ok = await loadRazorpayScript();
  if (!ok || !window.Razorpay) {
    throw new Error("Could not load Razorpay Checkout");
  }

  const rzp = new window.Razorpay(options);
  rzp.on?.("payment.failed", (err) => {
    console.error("Razorpay payment failed", err);
  });
  rzp.open();
}

export async function openRazorpayCheckout(input: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency?: string;
  name?: string;
  description?: string;
  email?: string | null;
  onSuccess: (res: RazorpaySuccess) => void;
  onDismiss?: () => void;
}) {
  if (!input.keyId) throw new Error("Razorpay key is missing");

  await openCheckout({
    key: input.keyId,
    amount: input.amountPaise,
    currency: input.currency ?? "INR",
    name: input.name ?? "Dady.ai",
    description: input.description ?? "Credit purchase",
    order_id: input.orderId,
    handler: input.onSuccess,
    prefill: { email: input.email ?? undefined },
    theme: { color: "#10b981" },
    modal: { ondismiss: input.onDismiss },
    method: {
      upi: true,
      card: true,
      netbanking: true,
      wallet: true,
    },
    remember_customer: true,
  });
}

export async function openRazorpaySubscriptionCheckout(input: {
  keyId: string;
  subscriptionId: string;
  name?: string;
  description?: string;
  email?: string | null;
  onSuccess: (res: RazorpaySuccess) => void;
  onDismiss?: () => void;
}) {
  if (!input.keyId) throw new Error("Razorpay key is missing");

  await openCheckout({
    key: input.keyId,
    name: input.name ?? "Dady.ai",
    description: input.description ?? "Monthly plan",
    subscription_id: input.subscriptionId,
    handler: input.onSuccess,
    prefill: { email: input.email ?? undefined },
    theme: { color: "#10b981" },
    modal: { ondismiss: input.onDismiss },
    method: {
      upi: true,
      card: true,
      netbanking: true,
      wallet: true,
    },
    remember_customer: true,
  });
}

export function isRazorpayTestKey(keyId: string | null | undefined) {
  return Boolean(keyId && keyId.startsWith("rzp_test_"));
}
