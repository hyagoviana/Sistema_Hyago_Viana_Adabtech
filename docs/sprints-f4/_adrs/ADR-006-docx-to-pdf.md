# ADR-006 — DOCX→PDF: LibreOffice headless em VPS Hetzner

> **Formato:** MADR-light · **Owner:** @architect Winston · **Aprovado por:** @pm John
> **Data:** 2026-05-20 · **Sprint:** 1 (provisioning) + Sprint 5 (uso) + Sprint 8 (uso crítico)
> **Atende:** Architect F-04 (BLOCKER) · **Pré-requisito:** Spike SP-03

---

## Status

**Proposto** — finalização condicionada ao resultado de **SP-03** (0.5 dia útil pré-Sprint 1). Se PASS → "Aprovado"; se FAIL → fallback documentado abaixo.

---

## Context

Sprints 5, 7 e 8 precisam de **conversão DOCX→PDF determinística**:
- **Sprint 5:** Declaração COVID + DGM (templates Word renderizados via `docxtemplater`).
- **Sprint 7:** Anexos para Gov.br/SEI.
- **Sprint 8:** Termo de Acerto PDF com **hash SHA-256 reproduzível** (Princípio P4 — imutabilidade pós-aprovação).

Cloudflare Workers **não roda binários nativos** (LibreOffice, Puppeteer). Supabase Edge Functions (Deno) idem. Precisa infra dedicada.

A v1.0 marcou ADR-006 como TODO. **Decidir antes do Sprint 5 é crítico** — descoberta tardia custa dias.

### Requisitos

1. **Determinismo:** mesmo DOCX gera mesmo PDF byte-a-byte (hash SHA-256 idêntico).
2. **Cross-environment:** staging e prod geram hash idêntico (fontes pinadas, versões iguais).
3. **Custo previsível:** < R$200/mês.
4. **Latência:** < 5s para PDF < 5MB.
5. **Throughput:** 50-100 PDFs/dia inicial; escala 5×.

---

## Decision

**LibreOffice headless em container Docker dentro da VPS Hetzner (mesma do n8n — ADR-003).**

### Setup

```dockerfile
# infrastructure/hetzner/libreoffice/Dockerfile
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    fonts-dejavu \
    fonts-noto \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Pinar versão LibreOffice via apt-pin (não auto-upgrade)
RUN echo "Package: libreoffice*" > /etc/apt/preferences.d/libreoffice && \
    echo "Pin: version 24.2.*" >> /etc/apt/preferences.d/libreoffice && \
    echo "Pin-Priority: 1001" >> /etc/apt/preferences.d/libreoffice

# Fontes pinadas
COPY fonts/*.ttf /usr/share/fonts/truetype/custom/
RUN fc-cache -fv

WORKDIR /app
COPY server.js /app/

EXPOSE 3000
CMD ["node", "server.js"]
```

```javascript
// infrastructure/hetzner/libreoffice/server.js
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

app.post('/convert', async (req, res) => {
  const id = crypto.randomBytes(8).toString('hex');
  const docxPath = `/tmp/${id}.docx`;
  const pdfPath = `/tmp/${id}.pdf`;

  await fs.writeFile(docxPath, req.body);

  // Flags determinísticos
  await new Promise((resolve, reject) => {
    exec(
      `libreoffice --headless --convert-to pdf:writer_pdf_Export --outdir /tmp ${docxPath}`,
      { env: { ...process.env, TZ: 'UTC', SOURCE_DATE_EPOCH: '1700000000' } },
      (err) => err ? reject(err) : resolve()
    );
  });

  const pdf = await fs.readFile(pdfPath);
  const hash = crypto.createHash('sha256').update(pdf).digest('hex');

  await Promise.all([fs.unlink(docxPath), fs.unlink(pdfPath)]);

  res.set('X-PDF-Hash', hash);
  res.set('Content-Type', 'application/pdf');
  res.send(pdf);
});

app.listen(3000);
```

### HMAC auth

Endpoint protegido por HMAC compartilhado com Cloudflare Workers / Edge Functions:

```javascript
app.use((req, res, next) => {
  const sig = req.headers['x-signature'];
  const expected = crypto.createHmac('sha256', process.env.HMAC_SECRET)
    .update(req.body).digest('hex');
  if (sig !== expected) return res.status(401).end();
  next();
});
```

### Determinismo: SOURCE_DATE_EPOCH + TZ UTC

LibreOffice respeita `SOURCE_DATE_EPOCH` para timestamps embutidos no PDF (reproducible-builds). Setando para epoch fixo + TZ UTC + fontes pinadas, hash é reproduzível.

### Verificação de determinismo no CI

```yaml
# .github/workflows/pdf-determinism.yml
- name: Generate PDF 5×
  run: |
    for i in {1..5}; do
      curl -X POST $VPS_URL/convert \
        -H "X-Signature: $SIG" \
        --data-binary @fixtures/termo-template.docx \
        -o /tmp/pdf-$i.pdf
      sha256sum /tmp/pdf-$i.pdf
    done | sort -u | wc -l | grep -q "^1$" || exit 1
```

Pipeline falha se >1 hash distinto em 5 gerações.

### Custo

- Marginal: $0 (compartilha VPS Hetzner já provisionada via ADR-003).
- Storage de PDFs: no Supabase Storage (não local).

---

## Consequences

### Positivas

- **Determinismo cruzado garantido** (SOURCE_DATE_EPOCH + TZ + fontes pinadas).
- **Custo zero** marginal (VPS já é necessária para n8n + Playwright).
- **Latência baixa** (~1-3s para PDF típico) — sem cold start.
- **Atende P4** (imutabilidade Termo) com hash verificável.

### Negativas / Riscos

- **SP-03 falha** → cair para fallback (Cloud Run + Puppeteer com fontes pinadas), custo $15-30/mês.
- **LibreOffice upgrade quebra determinismo** — mitigado por apt-pin versão 24.2.*; ADR revisita ao subir major.
- **VPS down → bloqueia geração Termo** — Sprint 8 (Termo) precisa fallback manual? Aceitável dado SLA Uptime Kuma.
- **CPU compartilhado com n8n + Playwright** — monitorar; escalar VPS se necessário.

### Verificação de hash em múltiplos pontos (atende QA F-03 + Architect S-01)

1. **Na geração:** server LibreOffice retorna `X-PDF-Hash`; Edge Function compara com hash calculado no PDF baixado.
2. **No upload para Storage:** assert que hash bate.
3. **Na apresentação Portal (Sprint 9):** Portal busca PDF do Storage; calcula hash; compara com `snapshot.pdf_hash`. Se divergir → 409 + alerta admin.
4. **No teste E2E Sprint 8:** gerar 2× → mesmo hash; falha bloqueia merge.

---

## Alternatives Considered

### A. Cloud Run + Puppeteer (HTML→PDF)

- **Pró:** managed; auto-scale; cold start aceitável (2-5s).
- **Contra:** Puppeteer/Chromium renderiza HTML, não DOCX (precisa pipeline DOCX→HTML antes — risco de divergência); custo variável $15-30/mês.
- **Rejeitada como primário** — usar como fallback se SP-03 falhar.

### B. Browserless.io SaaS

- **Pró:** zero infra; suporte oficial.
- **Contra:** caro ($50-200/mês); versões mudam → quebra determinismo; vendor lock-in.
- **Rejeitada.**

### C. PDFKit / pdf-lib (gerar PDF programaticamente)

- **Pró:** roda em Workers; sem binário.
- **Contra:** reescrever templates Word como código JS é inviável (Termo tem 10+ páginas com tabelas, headers, footers).
- **Rejeitada.**

### D. AWS Lambda + LibreOffice layer

- **Pró:** managed.
- **Contra:** cold start 10-15s; layer LibreOffice é hack mantido pela comunidade; vendor lock-in AWS.
- **Rejeitada.**

### E. Aspose.Words Cloud API

- **Pró:** alta qualidade comercial.
- **Contra:** caro (assinatura); vendor.
- **Rejeitada.**

---

## Fallback documentado (se SP-03 falhar)

1. Reabrir ADR-006 com status "Revisado".
2. Provisionar Google Cloud Run com Puppeteer (~R$120/mês adicional).
3. Sprint 8 absorver pipeline DOCX→HTML→PDF (risco de divergência de layout).
4. Garantir determinismo via:
   - Fontes pinadas em Dockerfile
   - User-Agent fixo
   - Viewport fixo
   - `Date.now()` mockado durante render
5. Hyago precisa aprovar custo adicional.

---

## Referências

- `_review-architect.md` §F-04 (BLOCKER)
- `_review-qa.md` §F-03 (imutabilidade Termo)
- Spike SP-03 (pré-Sprint 1) valida determinismo
- ADR-003 (hosting strategy) — VPS Hetzner compartilhada
- Story 1.7 (Sprint 1) provisiona LibreOffice
- Sprint 5 (Documentos) primeiro uso
- Sprint 8 (Termo) uso crítico com hash

---

> _Determinismo de PDF é um detalhe que parece pequeno mas vira pesadelo se ignorado. Esta ADR resolve antes do Sprint 5._
