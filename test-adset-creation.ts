#!/usr/bin/env tsx

/**
 * Test script per diagnosticare il problema di creazione adset
 *
 * Questo script:
 * 1. Verifica che l'autenticazione funzioni
 * 2. Ottiene la lista degli account pubblicitari
 * 3. Verifica i metodi di pagamento
 * 4. Crea una campagna di test
 * 5. Tenta di creare un adset con parametri minimali
 * 6. Mostra l'errore esatto ricevuto dall'API Meta
 */

import { MetaApiClient } from './src/meta-client.js';
import { AuthManager } from './src/utils/auth.js';

async function testAdSetCreation() {
  console.log('=== TEST CREAZIONE ADSET ===\n');

  try {
    // 1. Verifica autenticazione
    console.log('1️⃣ Verifica autenticazione...');
    const auth = AuthManager.fromEnvironment();
    const client = new MetaApiClient(auth);
    console.log('✅ Autenticazione OK\n');

    // 2. Ottieni lista account
    console.log('2️⃣ Recupero account pubblicitari...');
    const accounts = await client.getAdAccounts();

    if (accounts.length === 0) {
      throw new Error('Nessun account pubblicitario trovato');
    }

    console.log(`✅ Trovati ${accounts.length} account(s)`);
    accounts.forEach((acc, idx) => {
      console.log(`   ${idx + 1}. ${acc.name} (${acc.id}) - Status: ${acc.account_status}`);
    });

    const account = accounts[0];
    console.log(`\n📌 Uso account: ${account.name} (${account.id})\n`);

    // 3. Verifica metodi di pagamento
    console.log('3️⃣ Verifica metodi di pagamento...');
    try {
      const fundingSources = await client.getFundingSources(account.id);
      if (fundingSources.length === 0) {
        console.log('⚠️  PROBLEMA: Nessun metodo di pagamento configurato!');
        console.log('   Questo è spesso la causa degli errori "Invalid parameter"');
        console.log('   Vai su https://business.facebook.com/settings/payment-methods per aggiungerne uno\n');
      } else {
        console.log(`✅ Trovati ${fundingSources.length} metodo(i) di pagamento\n`);
      }
    } catch (error) {
      console.log('⚠️  Non è possibile verificare i metodi di pagamento (permessi insufficienti)\n');
    }

    // 4. Crea campagna di test (o usa una esistente)
    console.log('4️⃣ Recupero/Creazione campagna di test...');

    let campaign;
    const existingCampaigns = await client.getCampaigns(account.id, { limit: 5 });

    if (existingCampaigns.data.length > 0) {
      campaign = existingCampaigns.data[0];
      console.log(`✅ Uso campagna esistente: ${campaign.name} (${campaign.id})`);
      console.log(`   Obiettivo: ${campaign.objective}`);
      console.log(`   Status: ${campaign.status}\n`);
    } else {
      console.log('Creo nuova campagna di test...');
      const campaignResult = await client.createCampaign(account.id, {
        name: `Test Campaign ${Date.now()}`,
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        daily_budget: 1000, // $10.00
      });
      campaign = await client.getCampaign(campaignResult.id);
      console.log(`✅ Campagna creata: ${campaign.name} (${campaign.id})\n`);
    }

    // 5. Tenta di creare un adset con parametri MINIMI
    console.log('5️⃣ Tentativo di creazione adset...');
    console.log('\n--- PARAMETRI ADSET ---');

    const adSetData = {
      name: `Test AdSet ${Date.now()}`,
      daily_budget: 1000, // $10.00 in cents
      optimization_goal: 'LINK_CLICKS',
      billing_event: 'IMPRESSIONS',
      status: 'PAUSED',

      // Targeting minimo richiesto
      targeting: {
        age_min: 18,
        age_max: 65,
        geo_locations: {
          countries: ['US'],
          location_types: ['home', 'recent'],
        },
        targeting_optimization: 'none',
        brand_safety_content_filter_levels: ['FACEBOOK_STANDARD'],
      },

      // Altri campi richiesti
      attribution_spec: [
        { event_type: 'CLICK_THROUGH', window_days: 1 }
      ],
      destination_type: 'WEBSITE',
      is_dynamic_creative: false,
      use_new_app_click: false,
      configured_status: 'PAUSED',
      optimization_sub_event: 'NONE',
      recurring_budget_semantics: false,
    };

    // Se la campagna richiede promoted_object, aggiungilo
    const requiresPromotedObject = [
      'OUTCOME_TRAFFIC',
      'OUTCOME_ENGAGEMENT',
      'OUTCOME_APP_PROMOTION',
      'OUTCOME_LEADS',
      'OUTCOME_SALES',
    ].includes(campaign.objective);

    if (requiresPromotedObject) {
      console.log(`⚠️  Campaign objective ${campaign.objective} richiede promoted_object`);
      console.log('   Cercando Facebook Pages automaticamente...\n');

      try {
        // Ottieni le Facebook Pages dell'utente
        const token = auth.getAccessToken();
        const apiVersion = auth.getApiVersion();
        const pagesResponse = await fetch(
          `https://graph.facebook.com/${apiVersion}/me/accounts?fields=id,name&access_token=${token}`
        );

        if (!pagesResponse.ok) {
          throw new Error('Impossibile recuperare le Facebook Pages');
        }

        const pagesData = await pagesResponse.json();

        if (!pagesData.data || pagesData.data.length === 0) {
          console.log('❌ Nessuna Facebook Page trovata\n');
          console.log('PROSSIMI PASSI:');
          console.log('1. Crea una Facebook Page su https://www.facebook.com/pages/create');
          console.log('2. Oppure aggiungi manualmente il page_id allo script');
          console.log('3. Riprova il test\n');
          return;
        }

        const page = pagesData.data[0];
        console.log(`✅ Trovata Facebook Page: ${page.name} (${page.id})`);
        console.log(`   Uso questo Page ID per il test\n`);

        // Aggiungi promoted_object ai dati dell'adset
        (adSetData as any).promoted_object = {
          page_id: page.id
        };

      } catch (error) {
        console.log('❌ Errore nel recupero Facebook Pages\n');
        console.log('SOLUZIONE MANUALE:');
        console.log('1. Esegui: npx tsx get-page-id.ts');
        console.log('2. Copia il page_id mostrato');
        console.log('3. Modifica test-adset-creation.ts aggiungendo:');
        console.log('   adSetData.promoted_object = { page_id: "TUO_PAGE_ID" };\n');
        return;
      }
    }

    console.log(JSON.stringify(adSetData, null, 2));
    console.log('------------------------\n');

    console.log('Invio richiesta a Meta API...\n');

    const adSetResult = await client.createAdSet(campaign.id, adSetData);

    console.log('\n✅ ✅ ✅ ADSET CREATO CON SUCCESSO! ✅ ✅ ✅');
    console.log(`ID AdSet: ${adSetResult.id}\n`);

  } catch (error) {
    console.log('\n❌ ERRORE DURANTE LA CREAZIONE ADSET\n');

    if (error instanceof Error) {
      console.log('Messaggio di errore:');
      console.log(error.message);
      console.log('\n');

      // Prova a parsare l'errore Meta API
      try {
        const metaError = JSON.parse(error.message);

        if (metaError.error) {
          console.log('=== DETTAGLI ERRORE META API ===');
          console.log(`Messaggio: ${metaError.error.message}`);
          console.log(`Codice: ${metaError.error.code}`);
          console.log(`Tipo: ${metaError.error.type}`);
          if (metaError.error.error_subcode) {
            console.log(`Subcode: ${metaError.error.error_subcode}`);
          }
          if (metaError.error.fbtrace_id) {
            console.log(`FB Trace ID: ${metaError.error.fbtrace_id}`);
          }
          if (metaError.error.error_user_title) {
            console.log(`\nTitolo utente: ${metaError.error.error_user_title}`);
          }
          if (metaError.error.error_user_msg) {
            console.log(`Messaggio utente: ${metaError.error.error_user_msg}`);
          }
          if (metaError.error.error_data) {
            console.log('\nDati errore:');
            console.log(JSON.stringify(metaError.error.error_data, null, 2));
          }
          console.log('================================\n');

          // Diagnostica comune
          console.log('POSSIBILI CAUSE:');

          if (metaError.error.code === 100) {
            console.log('• Parametro invalido o mancante');
            console.log('• Combinazione incompatibile di optimization_goal e billing_event');
            console.log('• promoted_object mancante (se richiesto dall\'obiettivo)');
            console.log('• Metodo di pagamento non configurato sull\'account');
            console.log('• Budget troppo basso per la valuta dell\'account');
          } else if (metaError.error.code === 190) {
            console.log('• Token di accesso non valido o scaduto');
          } else if (metaError.error.code === 200) {
            console.log('• Permessi insufficienti');
          }
          console.log('');
        }
      } catch {
        // Errore non è JSON, già stampato sopra
      }
    }

    console.log('SUGGERIMENTI:');
    console.log('1. Verifica di avere un metodo di pagamento configurato');
    console.log('2. Controlla che la campagna sia configurata correttamente');
    console.log('3. Verifica i permessi sul tuo account pubblicitario');
    console.log('4. Assicurati che promoted_object sia fornito se necessario\n');
  }
}

// Esegui il test
testAdSetCreation().catch(console.error);
