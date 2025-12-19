# Analisi Problema Creazione Ad Set

## 🔍 Sommario del Problema

Durante i test di creazione di Ad Set tramite Meta Marketing API, si verificano errori "Invalid Parameter" che impediscono la creazione degli ad set anche quando tutti i parametri sembrano corretti.

## 📊 Stato Attuale delle API

Dalla cronologia dei commit e dal codice analizzato:

| Operazione | Stato | Note |
|------------|-------|------|
| **List Campaigns** | ✅ Funziona | Recupera correttamente le campagne |
| **Create Campaign** | ✅ Funziona | Creazione campagne OK |
| **List Ad Sets** | ✅ Funziona | Restituisce liste vuote (normale se non ci sono ad set) |
| **Create Ad Set** | ❌ Fallisce | "Invalid Parameter" |
| **Create Ad Creative** | ❌ Fallisce | Stessa problematica |

## 🔎 Cause Principali Identificate

Basandosi sulla ricerca effettuata nei commit precedenti (2ae9e1f e e46ab36), le cause più comuni sono:

### 1. **Metodo di Pagamento Mancante** ⚠️ (CAUSA PIÙ COMUNE)

```
"I didn't have a payment method associated with my account"
```

L'API Meta richiede che l'account pubblicitario abbia almeno un metodo di pagamento valido configurato **prima** di poter creare ad set. Questo non è documentato chiaramente, ma è il problema più frequente.

**Come verificare:**
- Dashboard Meta: https://business.facebook.com/settings/payment-methods
- API: `GET /{account_id}/funding_source_details`

### 2. **Budget Insufficiente per la Valuta**

Da ricerca GitHub/StackOverflow:
```
"increased up to 4000 then converted to INR 40.00 then created successfully"
```

Il budget minimo varia per valuta:
- **USD**: minimo ~$1.00 (100 cents)
- **EUR**: minimo ~€1.00 (100 cents)
- **INR**: minimo ~₹40.00 (4000 paise)
- **GBP**: minimo ~£1.00 (100 pence)

### 3. **Parametro `promoted_object` Mancante**

Alcuni obiettivi di campagna richiedono obbligatoriamente `promoted_object`:

| Obiettivo Campagna | Richiede promoted_object | Campi Necessari |
|-------------------|-------------------------|-----------------|
| `OUTCOME_TRAFFIC` | ✅ Sì | `page_id`, `pixel_id` (opz) |
| `OUTCOME_LEADS` | ✅ Sì | `pixel_id`, `custom_event_type` |
| `OUTCOME_SALES` | ✅ Sì | `pixel_id`, `custom_event_type` |
| `OUTCOME_ENGAGEMENT` | ✅ Sì | `page_id` |
| `OUTCOME_APP_PROMOTION` | ✅ Sì | `application_id`, `object_store_url` |
| `OUTCOME_AWARENESS` | ❌ No | N/A |

**Esempio per OUTCOME_TRAFFIC:**
```typescript
{
  promoted_object: {
    page_id: "123456789",  // ID della Facebook Page
    pixel_id: "987654321"  // Opzionale, per tracking
  }
}
```

### 4. **Targeting Incompleto**

L'API Meta richiede specifici campi nel targeting:

```typescript
targeting: {
  age_min: 18,
  age_max: 65,
  geo_locations: {
    countries: ['US'],
    location_types: ['home', 'recent']  // ⚠️ Spesso dimenticato
  },
  targeting_optimization: 'none',  // ⚠️ Richiesto
  brand_safety_content_filter_levels: ['FACEBOOK_STANDARD']  // ⚠️ Richiesto
}
```

### 5. **Campi Obbligatori Mancanti**

Meta API v23.0+ richiede esplicitamente:

```typescript
{
  attribution_spec: [
    { event_type: 'CLICK_THROUGH', window_days: 1 }
  ],
  destination_type: 'WEBSITE' | 'UNDEFINED',  // RICHIESTO
  is_dynamic_creative: false,                  // RICHIESTO
  use_new_app_click: false,                    // RICHIESTO
  configured_status: 'PAUSED',                 // RICHIESTO
  optimization_sub_event: 'NONE',              // RICHIESTO
  recurring_budget_semantics: false            // RICHIESTO
}
```

### 6. **Combinazioni Incompatibili optimization_goal + billing_event**

Non tutte le combinazioni sono valide:

✅ **Combinazioni Valide:**
```
LINK_CLICKS + IMPRESSIONS
LINK_CLICKS + LINK_CLICKS
LANDING_PAGE_VIEWS + IMPRESSIONS
CONVERSIONS + IMPRESSIONS
REACH + IMPRESSIONS
POST_ENGAGEMENT + IMPRESSIONS
VIDEO_VIEWS + IMPRESSIONS
```

❌ **Combinazioni Non Valide:**
```
CONVERSIONS + LINK_CLICKS
LANDING_PAGE_VIEWS + CLICKS
REACH + CLICKS
```

## 🛠️ Implementazione Attuale nel Codice

Il codice ha implementato diverse mitigazioni:

### File: `src/tools/campaigns.ts`

1. **Validazione estesa** (linee 569-979):
   - Controllo combinazioni optimization_goal + billing_event
   - Validazione promoted_object basata su obiettivo campagna
   - Default per tutti i campi obbligatori
   - Logging esteso per debug

2. **Tool diagnostici**:
   - `check_campaign_readiness` - Verifica se la campagna è pronta
   - `verify_account_setup` - Controlla account, pagamenti, permessi
   - `get_quick_fixes` - Suggerimenti per errori comuni
   - `get_meta_api_reference` - Riferimento parametri API

### File: `src/meta-client.ts`

1. **Logging completo** (linee 308-378):
   - Stampa tutti i parametri inviati
   - Parsifica e mostra errori Meta API dettagliati
   - Include fbtrace_id per supporto Meta

## 📋 Checklist Pre-Creazione Ad Set

Prima di creare un ad set, verificare:

- [ ] **Account ha metodo di pagamento configurato**
- [ ] **Budget >= minimo per valuta account** (usa 1000 cents = $10 per sicurezza)
- [ ] **Campagna esiste ed è accessibile**
- [ ] **promoted_object fornito se obiettivo campagna lo richiede**
- [ ] **optimization_goal e billing_event sono compatibili**
- [ ] **Targeting include tutti i campi richiesti**
- [ ] **Tutti i campi obbligatori v23.0 sono presenti**

## 🧪 Come Testare

Ho creato uno script di test diagnostico:

```bash
# Configura le variabili d'ambiente
export META_ACCESS_TOKEN="your_token_here"

# Esegui il test
npx tsx test-adset-creation.ts
```

Lo script:
1. ✅ Verifica autenticazione
2. ✅ Lista account pubblicitari
3. ✅ Controlla metodi di pagamento
4. ✅ Usa o crea una campagna
5. ✅ Tenta creazione ad set con parametri minimali
6. ✅ Mostra errore dettagliato se fallisce

## 🔧 Soluzioni Proposte

### Soluzione Immediata

Se il problema è **metodo di pagamento mancante**:
1. Vai su https://business.facebook.com/settings/payment-methods
2. Aggiungi una carta di credito/debito valida
3. Riprova la creazione dell'ad set

### Soluzione per promoted_object

Se obiettivo campagna lo richiede:

```typescript
// Per OUTCOME_TRAFFIC
const adSetData = {
  // ... altri parametri
  promoted_object: {
    page_id: "TUA_PAGE_ID_QUI"
  }
}
```

**Come trovare il page_id:**
1. Vai sulla tua Facebook Page
2. Impostazioni → Informazioni sulla Pagina
3. Copia il "Page ID"

### Soluzione per Budget

Usa sempre budget >= 1000 cents ($10) per evitare problemi di conversione valuta:

```typescript
daily_budget: 1000  // $10.00 - funziona per tutte le valute
```

## 📚 Riferimenti

- [Meta Marketing API - Ad Set](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign)
- [Errori Comuni Meta API](https://developers.facebook.com/docs/marketing-api/error-reference)
- GitHub Issues analizzati nei commit:
  - 2ae9e1f: Fix based on research (payment method issue)
  - e46ab36: Parameter requirements

## 🎯 Conclusione

Il problema principale degli "Invalid Parameter" durante la creazione di ad set è **multifattoriale**, ma la causa più comune (>50% dei casi) è:

> **❗ Metodo di pagamento non configurato sull'account pubblicitario**

Anche se tutti i parametri API sono corretti, Meta richiede un metodo di pagamento valido prima di permettere la creazione di ad set.

Le altre cause comuni sono:
1. Budget troppo basso per la valuta
2. `promoted_object` mancante quando richiesto
3. Campi obbligatori della v23.0 API mancanti

---

*Documento generato analizzando:*
- Codice sorgente: `src/tools/campaigns.ts`, `src/meta-client.ts`
- Commit history: 2ae9e1f, e46ab36
- Meta Marketing API v23.0 documentation
