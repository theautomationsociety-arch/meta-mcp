#!/usr/bin/env tsx

/**
 * Script per diagnosticare permessi e restrizioni Meta API
 * Identifica problemi specifici con error code 100, subcode 1815857
 */

import { MetaApiClient } from './src/meta-client.js';
import { AuthManager } from './src/utils/auth.js';

async function debugPermissions() {
  console.log('🔍 DEBUG PERMESSI E RESTRIZIONI META\n');
  console.log('='.repeat(70));

  try {
    const auth = AuthManager.fromEnvironment();
    const client = new MetaApiClient(auth);
    const token = auth.getAccessToken();
    const apiVersion = auth.getApiVersion();

    // 1. Verifica permessi del token
    console.log('\n1️⃣ PERMESSI DEL TOKEN');
    console.log('-'.repeat(70));

    try {
      const debugResponse = await fetch(
        `https://graph.facebook.com/${apiVersion}/debug_token?input_token=${token}&access_token=${token}`
      );
      const debugData = await debugResponse.json();

      if (debugData.data) {
        console.log('✅ Token valido');
        console.log(`   App ID: ${debugData.data.app_id}`);
        console.log(`   User ID: ${debugData.data.user_id}`);
        console.log(`   Scadenza: ${debugData.data.expires_at ? new Date(debugData.data.expires_at * 1000).toLocaleString() : 'Mai'}`);

        if (debugData.data.scopes) {
          console.log('\n   📋 Permessi (Scopes):');
          debugData.data.scopes.forEach((scope: string) => {
            const isAdsRelated = scope.includes('ads') || scope.includes('business') || scope.includes('pages');
            console.log(`      ${isAdsRelated ? '✅' : '  '} ${scope}`);
          });

          // Verifica permessi richiesti
          const requiredScopes = ['ads_management', 'ads_read', 'pages_read_engagement', 'pages_manage_ads'];
          const missingScopes = requiredScopes.filter(req => !debugData.data.scopes.includes(req));

          if (missingScopes.length > 0) {
            console.log('\n   ⚠️  PERMESSI MANCANTI:');
            missingScopes.forEach((scope: string) => console.log(`      ❌ ${scope}`));
          }
        }
      }
    } catch (error) {
      console.log('❌ Impossibile verificare permessi token');
    }

    // 2. Verifica account pubblicitario
    console.log('\n\n2️⃣ ACCOUNT PUBBLICITARIO');
    console.log('-'.repeat(70));

    const accounts = await client.getAdAccounts();
    if (accounts.length === 0) {
      console.log('❌ Nessun account trovato');
      return;
    }

    const account = accounts[0];
    console.log(`✅ Account: ${account.name}`);
    console.log(`   ID: ${account.id}`);
    console.log(`   Status: ${account.account_status === 1 ? '✅ Attivo' : `❌ Non attivo (${account.account_status})`}`);
    console.log(`   Valuta: ${account.currency}`);

    // Verifica dettagli account
    try {
      const accountDetails = await client.getAdAccount(account.id);

      if (accountDetails.account_status !== 1) {
        console.log('\n   ⚠️  PROBLEMA: Account non attivo!');
        console.log('   Possibili cause:');
        console.log('   - Account in revisione');
        console.log('   - Account disabilitato per violazioni');
        console.log('   - Account richiede verifiche aggiuntive');
      }
    } catch (error) {
      console.log('   ⚠️  Impossibile ottenere dettagli completi account');
    }

    // 3. Verifica Facebook Pages
    console.log('\n\n3️⃣ FACEBOOK PAGES');
    console.log('-'.repeat(70));

    try {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/${apiVersion}/me/accounts?fields=id,name,access_token,tasks,category,category_list&access_token=${token}`
      );
      const pagesData = await pagesResponse.json();

      if (!pagesData.data || pagesData.data.length === 0) {
        console.log('❌ Nessuna Facebook Page trovata');
        return;
      }

      for (const page of pagesData.data) {
        console.log(`\n   📄 Page: ${page.name}`);
        console.log(`      ID: ${page.id}`);
        console.log(`      Categoria: ${page.category}`);

        if (page.tasks) {
          console.log('      Permessi sulla Page:');
          page.tasks.forEach((task: string) => console.log(`         - ${task}`));

          // Verifica permessi critici
          const requiredTasks = ['ADVERTISE', 'ANALYZE', 'CREATE_CONTENT'];
          const missingTasks = requiredTasks.filter(req => !page.tasks.includes(req));

          if (missingTasks.length > 0) {
            console.log('\n      ⚠️  PERMESSI MANCANTI SULLA PAGE:');
            missingTasks.forEach((task: string) => console.log(`         ❌ ${task}`));
            console.log('\n      💡 Soluzione: Vai su facebook.com/${page.id}/settings');
            console.log('         → Page Roles → Aggiungi te stesso come Admin');
          } else {
            console.log('      ✅ Tutti i permessi necessari presenti');
          }
        } else {
          console.log('      ⚠️  Impossibile verificare permessi sulla page');
        }

        // Verifica restrizioni sulla page
        try {
          const pageInfoResponse = await fetch(
            `https://graph.facebook.com/${apiVersion}/${page.id}?fields=is_published,is_verified,restriction_info&access_token=${page.access_token || token}`
          );
          const pageInfo = await pageInfoResponse.json();

          if (!pageInfo.is_published) {
            console.log('      ⚠️  Page non pubblicata!');
          }

          if (pageInfo.restriction_info) {
            console.log('      ⚠️  RESTRIZIONI SULLA PAGE:');
            console.log(`         ${JSON.stringify(pageInfo.restriction_info, null, 2)}`);
          }
        } catch (error) {
          // Ignore
        }
      }
    } catch (error) {
      console.log('❌ Errore nel recupero Facebook Pages');
    }

    // 4. Verifica campagne
    console.log('\n\n4️⃣ CAMPAGNE');
    console.log('-'.repeat(70));

    const campaigns = await client.getCampaigns(account.id, { limit: 5 });

    if (campaigns.data.length === 0) {
      console.log('❌ Nessuna campagna trovata');
    } else {
      const campaign = campaigns.data[0];
      console.log(`✅ Campagna di test: ${campaign.name}`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   Obiettivo: ${campaign.objective}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Effective Status: ${campaign.effective_status}`);

      if (campaign.effective_status !== 'ACTIVE' && campaign.effective_status !== 'PAUSED') {
        console.log(`\n   ⚠️  PROBLEMA: Effective status non è ACTIVE/PAUSED`);
        console.log('   La campagna potrebbe avere problemi che impediscono la creazione di ad set');
      }
    }

    // 5. Test permessi creazione
    console.log('\n\n5️⃣ RACCOMANDAZIONI PER ERROR 1815857');
    console.log('-'.repeat(70));

    console.log('\nError code 100, subcode 1815857 indica tipicamente:');
    console.log('❌ Permessi insufficienti sulla Facebook Page');
    console.log('❌ Page non autorizzata per pubblicità');
    console.log('❌ Restrizioni sull\'account pubblicitario');
    console.log('❌ Token manca permessi "pages_manage_ads"');

    console.log('\n📋 AZIONI DA FARE:');
    console.log('\n1. Verifica di essere ADMIN della Facebook Page');
    console.log('   → Vai su https://facebook.com/settings');
    console.log('   → Page Roles → Verifica il tuo ruolo');

    console.log('\n2. Rigenera il token con TUTTI i permessi:');
    console.log('   → https://developers.facebook.com/tools/explorer/');
    console.log('   → Seleziona permessi:');
    console.log('      ✅ ads_management');
    console.log('      ✅ ads_read');
    console.log('      ✅ pages_read_engagement');
    console.log('      ✅ pages_manage_ads (IMPORTANTE!)');
    console.log('      ✅ business_management');

    console.log('\n3. Verifica che la Page sia pubblicata:');
    console.log('   → Impostazioni Page → Generale → Visibilità Page');

    console.log('\n4. Controlla che l\'account pubblicitario non abbia restrizioni:');
    console.log('   → https://business.facebook.com/adsmanager');
    console.log('   → Account Quality → Verifica status');

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ Analisi completata\n');

  } catch (error) {
    console.log('\n❌ ERRORE DURANTE LA DIAGNOSI\n');
    console.error(error);
  }
}

debugPermissions().catch(console.error);
