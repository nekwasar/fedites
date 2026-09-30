/**
 * Payment gateway abstraction (Phase 4, 4.1) — pluggable like the face
 * provider. The MANUAL gateway ships first: §P mandates "online gateway +
 * manual mark as paid", so cash/offline payments are confirmed by the
 * treasurer. Real gateways (Paystack / Flutterwave / Stripe) implement the
 * same interface and activate via PAYMENT_PROVIDER env + keys without
 * touching callers. Honest limitation of manual mode: no live checkout —
 * the intent awaits treasurer confirmation.
 */
import { randomUUID } from "node:crypto";

export interface InitiateInput {
  amountMinor: number;
  currency: string;
  purpose: string;
  memberRef: string; // opaque id the gateway can echo
}

export interface GatewayResult {
  provider: string;
  providerRef: string;
  checkoutUrl: string | null;
}

export interface PaymentGateway {
  readonly name: string;
  readonly available: boolean;
  initiate(input: InitiateInput): Promise<GatewayResult>;
}

class ManualGateway implements PaymentGateway {
  readonly name = "manual";
  readonly available = true;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- interface conformance; real adapters read the input
  async initiate(_input: InitiateInput): Promise<GatewayResult> {
    // Cash / bank transfer / mobile money: the member pays offline and the
    // treasurer confirms. Reference is generated here for the receipt trail.
    return {
      provider: this.name,
      providerRef: `manual-${randomUUID()}`,
      checkoutUrl: null,
    };
  }
}

class PaystackGateway implements PaymentGateway {
  readonly name = "paystack";
  readonly available = process.env.PAYSTACK_SECRET_KEY !== undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- interface conformance; real adapters read the input
  async initiate(_input: InitiateInput): Promise<GatewayResult> {
    throw new Error("Paystack gateway not configured in this build. Set PAYSTACK_SECRET_KEY and implement the checkout call.");
  }
}

class FlutterwaveGateway implements PaymentGateway {
  readonly name = "flutterwave";
  readonly available = process.env.FLUTTERWAVE_SECRET_KEY !== undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- interface conformance; real adapters read the input
  async initiate(_input: InitiateInput): Promise<GatewayResult> {
    throw new Error("Flutterwave gateway not configured in this build.");
  }
}

class StripeGateway implements PaymentGateway {
  readonly name = "stripe";
  readonly available = process.env.STRIPE_SECRET_KEY !== undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- interface conformance; real adapters read the input
  async initiate(_input: InitiateInput): Promise<GatewayResult> {
    throw new Error("Stripe gateway not configured in this build.");
  }
}

export function getGateway(): PaymentGateway {
  switch (process.env.PAYMENT_PROVIDER) {
    case "paystack": return new PaystackGateway();
    case "flutterwave": return new FlutterwaveGateway();
    case "stripe": return new StripeGateway();
    default: return new ManualGateway();
  }
}
