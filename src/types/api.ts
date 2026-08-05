export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "user" | "support" | "admin" | "super_admin";

export type GenerationStatus =
  | "draft"
  | "validating"
  | "queued"
  | "generating"
  | "enhancing"
  | "completed"
  | "failed"
  | "failed_refunded"
  | "cancelled"
  | "cancelled_refunded";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  country_code: string;
  preferred_language: string | null;
  onboarding_completed: boolean;
  auth_provider: string | null;
  account_status: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  user_id: string;
  available_credits: number;
  reserved_credits: number;
  lifetime_purchased: number;
  lifetime_promotional: number;
  lifetime_used: number;
  lifetime_refunded: number;
  updated_at: string;
}

export type CreditTransactionType =
  | "PURCHASE"
  | "SUBSCRIPTION_RENEWAL"
  | "GENERATION_RESERVE"
  | "GENERATION_CAPTURE"
  | "GENERATION_RELEASE"
  | "GENERATION_REFUND"
  | "PROMOTIONAL_CREDIT"
  | "REFERRAL_CREDIT"
  | "ADMIN_ADJUSTMENT"
  | "EXPIRY";

export interface CreditTransaction {
  id: string;
  user_id: string;
  transaction_type: CreditTransactionType;
  credits: number;
  balance_before: number;
  balance_after: number;
  source_type: string | null;
  source_id: string | null;
  generation_id: string | null;
  order_id: string | null;
  description: string | null;
  created_at: string;
  generations?: {
    generation_type: string | null;
    prompt: string | null;
    application_status: string | null;
    model_catalog?: { friendly_name: string | null } | null;
    projects?: { name: string | null } | null;
  } | null;
}

export interface CreditGrant {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string | null;
  credits_total: number;
  credits_remaining: number;
  expires_at: string | null;
  status: string;
  created_at: string;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_inr: number;
  billing_interval: string;
  included_credits: number;
  credit_validity_days: number;
  active: boolean;
  display_order: number;
  metadata: Json;
  razorpay_plan_id: string | null;
}

export interface CreditPack {
  id: string;
  slug: string;
  name: string;
  price_inr: number;
  credits: number;
  validity_days: number;
  active: boolean;
  display_order: number;
  metadata: Json;
}

export interface ModelCatalogItem {
  id: string;
  provider: string;
  provider_model_id: string;
  friendly_name: string;
  slug: string;
  category: string;
  generation_type: "image" | "video" | "audio" | "utility";
  description: string | null;
  quality_tier: string;
  credit_cost: number;
  credits_per_unit?: number | null;
  pricing_unit?: string | null;
  estimated_provider_cost_usd?: number | null;
  estimated_provider_cost_inr?: number | null;
  margin_pct?: number | null;
  fx_usd_inr?: number | null;
  commercial_use_allowed: boolean;
  supports_image_input: boolean;
  supported_aspect_ratios: string[];
  supported_durations?: number[];
  active: boolean;
  display_order: number;
  configuration: Json;
}

export interface Generation {
  id: string;
  user_id: string;
  project_id: string | null;
  model_id: string;
  generation_type: string;
  prompt: string | null;
  application_status: GenerationStatus;
  credits_reserved: number;
  credits_charged: number;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  estimated_credit_cost: number | null;
  active: boolean;
  featured: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  order_type: "credit_pack" | "subscription";
  credit_pack_id: string | null;
  plan_id: string | null;
  provider_order_id: string | null;
  amount_inr: number;
  amount_paise: number;
  status: string;
  created_at: string;
}

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "INSUFFICIENT_CREDITS"
  | "MODEL_UNAVAILABLE"
  | "MODEL_CONFIGURATION_INVALID"
  | "RATE_LIMITED"
  | "TOO_MANY_ACTIVE_JOBS"
  | "INVALID_INPUT"
  | "PAYMENT_FAILED"
  | "PAYMENT_PENDING"
  | "PAYMENT_ALREADY_PROCESSED"
  | "GENERATION_SUBMISSION_FAILED"
  | "GENERATION_FAILED_REFUNDED"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "MOCK_MODE";

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
