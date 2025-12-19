# 🛠️ Guida al Debug della Creazione Ad Set

## 🚀 Quick Start

Se ricevi errori "Invalid Parameter" durante la creazione di ad set, segui questi passaggi:

### 1. Diagnosi Rapida (1 minuto)

```bash
# Configura il token
export META_ACCESS_TOKEN="your_access_token_here"

# Esegui la diagnosi
npx tsx diagnose-account.ts
```

Questo script ti dirà immediatamente se:
- ✅ L'autenticazione funziona
- ⚠️  Manca un metodo di pagamento (problema più comune)
- ⚠️  L'account non è attivo
- ℹ️  Quali campagne hai e se richiedono `promoted_object`

### 2. Test Completo (2-3 minuti)

```bash
npx tsx test-adset-creation.ts
```

Questo script:
- Tenta di creare un ad set di test
- Mostra l'errore esatto ricevuto dall'API Meta
- Fornisce suggerimenti specifici per risolverlo

## 📋 Problemi Comuni e Soluzioni

### ❌ "PROBLEMA: Nessun metodo di pagamento configurato!"

**Causa:** Questo è il problema #1 (>50% dei casi)

**Soluzione:**
1. Vai su https://business.facebook.com/settings/payment-methods
2. Clicca "Aggiungi metodo di pagamento"
3. Inserisci i dati della carta di credito/debito
4. Conferma
5. Riprova

**Nota:** Anche se non vuoi spendere soldi reali (ad set in PAUSED), Meta richiede comunque un metodo di pagamento configurato per creare l'ad set.

### ❌ "Campaign objective OUTCOME_TRAFFIC richiede promoted_object"

**Causa:** Alcuni obiettivi di campagna richiedono che tu specifichi cosa stai promuovendo

**Soluzione per OUTCOME_TRAFFIC:**

```typescript
// Trova il tuo Page ID:
// 1. Vai sulla tua Facebook Page
// 2. Impostazioni → Informazioni sulla Pagina
// 3. Copia il "Page ID"

const adSetData = {
  // ... altri parametri
  promoted_object: {
    page_id: "123456789"  // Il tuo Page ID qui
  }
}
```

**Obiettivi che richiedono promoted_object:**
- `OUTCOME_TRAFFIC` → richiede `page_id`
- `OUTCOME_LEADS` → richiede `pixel_id`
- `OUTCOME_SALES` → richiede `pixel_id`
- `OUTCOME_ENGAGEMENT` → richiede `page_id`
- `OUTCOME_APP_PROMOTION` → richiede `application_id`

### ❌ "Invalid combination: optimization_goal=... billing_event=..."

**Causa:** Non tutte le combinazioni sono valide

**Soluzione:** Usa una combinazione valida:

✅ **Combinazioni Sicure (sempre funzionano):**
```typescript
optimization_goal: 'LINK_CLICKS',
billing_event: 'IMPRESSIONS'
```

```typescript
optimization_goal: 'LANDING_PAGE_VIEWS',
billing_event: 'IMPRESSIONS'
```

```typescript
optimization_goal: 'REACH',
billing_event: 'IMPRESSIONS'
```

**Regola generale:** `IMPRESSIONS` come `billing_event` funziona con quasi tutti gli `optimization_goal`.

### ❌ "Budget amount too low"

**Causa:** Budget minimo varia per valuta

**Soluzione:** Usa sempre almeno 1000 cents:

```typescript
daily_budget: 1000  // = $10.00 USD, €10.00 EUR, ecc.
```

**Budget minimi per valuta:**
- USD: $1.00 (100 cents) minimo, $10.00 (1000 cents) consigliato
- EUR: €1.00 (100 cents) minimo, €10.00 (1000 cents) consigliato
- INR: ₹40.00 (4000 paise) minimo, ₹100.00 (10000) consigliato
- GBP: £1.00 (100 pence) minimo, £10.00 (1000 pence) consigliato

## 🔧 Parametri Minimi per un Ad Set Funzionante

Questo è l'esempio minimo che dovrebbe funzionare (se hai metodo di pagamento e promoted_object se richiesto):

```typescript
const adSetData = {
  name: 'My Ad Set',
  daily_budget: 1000,  // $10.00
  optimization_goal: 'LINK_CLICKS',
  billing_event: 'IMPRESSIONS',
  status: 'PAUSED',  // Non spenderai soldi

  // Targeting minimo
  targeting: {
    age_min: 18,
    age_max: 65,
    geo_locations: {
      countries: ['US'],
      location_types: ['home', 'recent']
    },
    targeting_optimization: 'none',
    brand_safety_content_filter_levels: ['FACEBOOK_STANDARD']
  },

  // Campi obbligatori API v23.0
  attribution_spec: [
    { event_type: 'CLICK_THROUGH', window_days: 1 }
  ],
  destination_type: 'WEBSITE',
  is_dynamic_creative: false,
  use_new_app_click: false,
  configured_status: 'PAUSED',
  optimization_sub_event: 'NONE',
  recurring_budget_semantics: false
};

// Aggiungi promoted_object se la campagna lo richiede
if (campaignObjective === 'OUTCOME_TRAFFIC') {
  adSetData.promoted_object = {
    page_id: 'YOUR_PAGE_ID'
  };
}
```

## 📚 Tool MCP Disponibili

Il repository include tool MCP per aiutarti:

### `check_campaign_readiness`
Verifica se una campagna è pronta per creare ad set

```typescript
// Via MCP
{
  "tool": "check_campaign_readiness",
  "arguments": {
    "campaign_id": "123456789"
  }
}
```

### `verify_account_setup`
Verifica configurazione completa dell'account

```typescript
{
  "tool": "verify_account_setup",
  "arguments": {
    "account_id": "act_123456789"
  }
}
```

### `get_quick_fixes`
Ottieni suggerimenti per un errore specifico

```typescript
{
  "tool": "get_quick_fixes",
  "arguments": {
    "error_message": "Invalid parameter"
  }
}
```

### `get_meta_api_reference`
Mostra parametri validi e combinazioni

```typescript
{
  "tool": "get_meta_api_reference",
  "arguments": {}
}
```

## 🎯 Flowchart di Debug

```
Hai errore "Invalid Parameter"?
│
├─> Esegui: npx tsx diagnose-account.ts
│   │
│   ├─> Manca metodo pagamento?
│   │   └─> Aggiungi su business.facebook.com
│   │
│   ├─> Campagna richiede promoted_object?
│   │   └─> Aggiungi page_id/pixel_id appropriato
│   │
│   └─> Account attivo?
│       └─> Verifica su business.facebook.com
│
└─> Esegui: npx tsx test-adset-creation.ts
    │
    └─> Leggi errore dettagliato
        └─> Segui suggerimenti specifici
```

## 💡 Tips Aggiuntivi

1. **Testa sempre con status: 'PAUSED'**
   - Non spenderai soldi
   - Puoi verificare che tutto funziona
   - Attiva solo quando sei pronto

2. **Usa budget generosi per i test**
   - Budget bassi possono causare errori inspiegabili
   - Usa 1000 cents ($10) o più per i test
   - L'ad set è in pausa, non spenderai nulla

3. **Inizia con parametri semplici**
   - Usa LINK_CLICKS + IMPRESSIONS
   - Targeting base (US, età 18-65)
   - Aggiungi complessità solo dopo che funziona

4. **Controlla i log**
   - Il codice stampa tutti i dettagli su console.error
   - Cerca i log che iniziano con "==="
   - Include fbtrace_id per supporto Meta

5. **Facebook Pixel**
   - Non è obbligatorio per tutti gli obiettivi
   - Ma se usi CONVERSIONS, devi averlo configurato
   - Verifica su Events Manager di Facebook

## 🆘 Ancora Bloccato?

Se continui ad avere problemi:

1. ✅ Esegui entrambi gli script di diagnosi
2. ✅ Leggi completamente `ANALISI_PROBLEMA_ADSET.md`
3. ✅ Verifica che TUTTI i checkpoints siano ✅
4. ✅ Copia l'output completo degli script
5. ✅ Apri una issue con i dettagli

## 📞 Link Utili

- **Meta Business Manager:** https://business.facebook.com
- **Metodi di Pagamento:** https://business.facebook.com/settings/payment-methods
- **Events Manager:** https://business.facebook.com/events_manager2
- **Meta Marketing API Docs:** https://developers.facebook.com/docs/marketing-api
- **Error Reference:** https://developers.facebook.com/docs/marketing-api/error-reference

---

*Ultima modifica: 2025-06-30*
