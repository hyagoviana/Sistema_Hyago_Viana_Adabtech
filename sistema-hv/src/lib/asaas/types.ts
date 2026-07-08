// Tipos da API do Asaas (v3).
// Ref: https://docs.asaas.com/reference

// ─── Customer ────────────────────────────────────────────────────────────────

export type AsaasCustomerCreate = {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  additionalEmails?: string;
  municipalInscription?: string;
  stateInscription?: string;
  observations?: string;
  groupName?: string;
  company?: string;
  foreignCustomer?: boolean;
};

export type AsaasCustomer = AsaasCustomerCreate & {
  id: string;
  dateCreated: string;
  deleted: boolean;
  personType: "FISICA" | "JURIDICA";
  city?: number;
  state?: string;
  country?: string;
  canDelete: boolean;
  cannotBeDeletedReason?: string;
  canEdit: boolean;
  cannotEditReason?: string;
};

// ─── Payment / Cobrança ──────────────────────────────────────────────────────

export type AsaasBillingType = "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";

export type AsaasDiscount = {
  value: number;
  dueDateLimitDays: number;
  type: "FIXED" | "PERCENTAGE";
};

export type AsaasInterest = {
  value: number; // % ao mês
};

export type AsaasFine = {
  value: number; // % (multa)
  type?: "FIXED" | "PERCENTAGE";
};

export type AsaasPaymentCreate = {
  customer: string; // Asaas customer ID
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  totalValue?: number;
  discount?: AsaasDiscount;
  interest?: AsaasInterest;
  fine?: AsaasFine;
  postalService?: boolean;
  daysAfterDueDateToRegistrationCancellation?: number;
};

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED"
  | "REFUND_IN_PROGRESS"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS";

export type AsaasPayment = {
  id: string;
  dateCreated: string;
  customer: string;
  installment?: string;
  paymentLink?: string;
  value: number;
  netValue: number;
  originalValue?: number;
  interestValue?: number;
  description?: string;
  billingType: AsaasBillingType;
  confirmedDate?: string;
  pixTransaction?: string;
  status: AsaasPaymentStatus;
  dueDate: string;
  originalDueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  installmentNumber?: number;
  invoiceUrl: string;
  invoiceNumber?: string;
  externalReference?: string;
  deleted: boolean;
  anticipated: boolean;
  anticipable: boolean;
  creditDate?: string;
  estimatedCreditDate?: string;
  transactionReceiptUrl?: string;
  nossoNumero?: string;
  bankSlipUrl?: string;
  lastInvoiceViewedDate?: string;
  lastBankSlipViewedDate?: string;
  postalService: boolean;
};

// ─── Pix QR Code ─────────────────────────────────────────────────────────────

export type AsaasPixQrCode = {
  encodedImage: string; // base64 da imagem
  payload: string; // copia-e-cola
  expirationDate: string;
};

// ─── Webhook ─────────────────────────────────────────────────────────────────

export type AsaasWebhookEvent =
  | "PAYMENT_CREATED"
  | "PAYMENT_AWAITING_RISK_ANALYSIS"
  | "PAYMENT_APPROVED_BY_RISK_ANALYSIS"
  | "PAYMENT_REPROVED_BY_RISK_ANALYSIS"
  | "PAYMENT_UPDATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_ANTICIPATED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_RESTORED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_REFUND_IN_PROGRESS"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_CHARGEBACK_DISPUTE"
  | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
  | "PAYMENT_DUNNING_RECEIVED"
  | "PAYMENT_DUNNING_REQUESTED"
  | "PAYMENT_BANK_SLIP_VIEWED"
  | "PAYMENT_CHECKOUT_VIEWED";

export type AsaasWebhookPayload = {
  event: AsaasWebhookEvent;
  payment: AsaasPayment;
};

// ─── Listagem paginada ───────────────────────────────────────────────────────

export type AsaasList<T> = {
  object: "list";
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
};
