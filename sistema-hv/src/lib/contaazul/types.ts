// Tipos da API do Conta Azul (v1).
// Ref: https://api.contaazul.com/schema

// ─── Customer ────────────────────────────────────────────────────────────────

export type ContaAzulPersonType = "NATURAL" | "LEGAL";

export type ContaAzulCustomerCreate = {
  name: string;
  company_name?: string;
  email?: string;
  business_phone?: string;
  mobile_phone?: string;
  person_type: ContaAzulPersonType;
  document?: string; // CPF ou CNPJ
  identity_document?: string; // RG
  state_registration_number?: string;
  date_of_birth?: string; // YYYY-MM-DD
  notes?: string;
  address?: {
    zip_code?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: {
      name?: string;
    };
    state?: {
      name?: string;
    };
  };
};

export type ContaAzulCustomer = ContaAzulCustomerCreate & {
  id: string;
  created_at?: string;
  status?: "ENABLED" | "DISABLED";
};

// ─── Product / Service ───────────────────────────────────────────────────────

export type ContaAzulProduct = {
  id: string;
  name: string;
  value: number;
  cost: number;
  code?: string;
  barcode?: string;
  available_stock?: number;
  ncm_code?: string;
  cest_code?: string;
  net_weight?: number;
  gross_weight?: number;
  unit_measure?: string;
};

export type ContaAzulService = {
  id: string;
  name: string;
  value: number;
  cost: number;
  code?: string;
  type?: "PROVIDED" | "TAKEN" | "BOTH";
};

// ─── Sale ────────────────────────────────────────────────────────────────────

export type ContaAzulPaymentType = "CASH" | "TIMES";

export type ContaAzulPaymentMethod =
  | "BANKING_BILLET"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "DIGITAL_WALLET"
  | "BANKING_TRANSFER"
  | "INSTANT_PAYMENT" // Pix
  | "CHECK"
  | "CASH"
  | "OTHER"
  | "AUTOMATIC_DEBIT";

export type ContaAzulInstallmentStatus = "PENDING" | "ACQUITTED";

export type ContaAzulSaleProduct = {
  description?: string;
  quantity: number;
  product_id: string;
  value: number;
};

export type ContaAzulSaleService = {
  description?: string;
  quantity: number;
  service_id: string;
  value: number;
};

export type ContaAzulPayment = {
  type: ContaAzulPaymentType;
  method: ContaAzulPaymentMethod;
  installments?: number;
  financial_account_id?: string;
};

export type ContaAzulSaleCreate = {
  emission: string; // YYYY-MM-DD
  status: "COMMITTED";
  customer_id: string;
  products?: ContaAzulSaleProduct[];
  services?: ContaAzulSaleService[];
  payment: ContaAzulPayment;
  notes?: string;
  discount?: {
    measure?: "VALUE" | "PERCENTAGE";
    rate?: number;
  };
};

export type ContaAzulInstallment = {
  number: number;
  value: number;
  due_date: string;
  status: ContaAzulInstallmentStatus;
  acquitted_date?: string;
};

export type ContaAzulSale = ContaAzulSaleCreate & {
  id: string;
  number?: number;
  total?: number;
  installments?: ContaAzulInstallment[];
};

// ─── Auth / Token ────────────────────────────────────────────────────────────

export type ContaAzulTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
};

// ─── Lista paginada ──────────────────────────────────────────────────────────

export type ContaAzulList<T> = T[];

// ─── Seller ──────────────────────────────────────────────────────────────────

export type ContaAzulSeller = {
  id: string;
  name: string;
};

// ─── Bank Account ────────────────────────────────────────────────────────────

export type ContaAzulBankAccount = {
  id: string;
  name: string;
  paymentType?: string;
};
