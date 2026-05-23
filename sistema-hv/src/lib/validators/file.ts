// Validação de upload de arquivos.
// Combina mime-type declarado + magic bytes do conteúdo pra evitar spoofing.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

// Mime types aceitos no MVP (alinhado com o plano MVP-3).
export const ALLOWED_MIMES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

// Assinaturas em hex (primeiros bytes do arquivo).
// DOCX/XLSX/ODT são containers ZIP — todos começam com PK\x03\x04.
const SIGNATURES: Array<{ hex: string; mimes: string[] }> = [
  { hex: "25504446", mimes: ["application/pdf"] },
  {
    hex: "504b0304",
    mimes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.oasis.opendocument.text",
    ],
  },
  { hex: "d0cf11e0a1b11ae1", mimes: ["application/msword"] },
  { hex: "ffd8ff", mimes: ["image/jpeg"] },
  { hex: "89504e470d0a1a0a", mimes: ["image/png"] },
];

export type FileValidationResult = { ok: true } | { ok: false; reason: string; status: number };

export function validateUpload(opts: {
  name: string;
  mimeType: string;
  size: number;
  head: Buffer;
}): FileValidationResult {
  if (!opts.name || opts.name.trim() === "") {
    return { ok: false, reason: "Nome do arquivo vazio", status: 400 };
  }
  if (opts.size <= 0) {
    return { ok: false, reason: "Arquivo vazio", status: 400 };
  }
  if (opts.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `Arquivo maior que o limite de ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`,
      status: 413,
    };
  }
  if (!ALLOWED_MIMES.has(opts.mimeType)) {
    return {
      ok: false,
      reason: `Tipo de arquivo não permitido (${opts.mimeType || "vazio"})`,
      status: 415,
    };
  }

  // Magic bytes — pula validação para text/plain (não tem assinatura confiável).
  if (opts.mimeType === "text/plain") return { ok: true };

  const headHex = opts.head.subarray(0, 16).toString("hex").toLowerCase();
  const match = SIGNATURES.find((s) => headHex.startsWith(s.hex));
  if (!match) {
    return {
      ok: false,
      reason: "Conteúdo do arquivo não corresponde ao tipo declarado (possível spoofing)",
      status: 415,
    };
  }
  if (!match.mimes.includes(opts.mimeType)) {
    return {
      ok: false,
      reason: `Conteúdo é ${match.mimes[0]} mas Content-Type diz ${opts.mimeType}`,
      status: 415,
    };
  }

  return { ok: true };
}
