#!/usr/bin/env tsx

/**
 * Script di Diagnosi Rapida Account Meta
 *
 * Verifica velocemente:
 * - Autenticazione
 * - Account pubblicitari disponibili
 * - Metodi di pagamento
 * - Campagne esistenti
 * - Facebook Pages accessibili
 */

import { MetaApiClient } from './src/meta-client.js';
import { AuthManager } from './src/utils/auth.js';

async function diagnoseAccount() {
  console.log('🔍 DIAGNOSI ACCOUNT META\n');
  console.log('='.repeat(50));

  try {
    // Autenticazione
    console.log('\n1️⃣ AUTENTICAZIONE');
    const auth = AuthManager.fromEnvironment();
    const client = new MetaApiClient(auth);
    console.log('   ✅ Token di accesso configurato');

    // Account pubblicitari
    console.log('\n2️⃣ ACCOUNT PUBBLICITARI');
    const accounts = await client.getAdAccounts();

    if (accounts.length === 0) {
      console.log('   ❌ Nessun account pubblicitario trovato');
      console.log('   → Assicurati di avere accesso ad almeno un account pubblicitario');
      return;
    }

    console.log(`   ✅ Trovati ${accounts.length} account(s)\n`);

    for (const account of accounts) {
      console.log(`   📊 ${account.name}`);
      console.log(`      ID: ${account.id}`);
      console.log(`      Valuta: ${account.currency}`);
      console.log(`      Status: ${account.account_status === 1 ? '✅ Attivo' : '❌ Non Attivo'}`);

      if (account.balance) {
        console.log(`      Balance: ${account.balance} ${account.currency}`);
      }

      // Metodi di pagamento
      console.log('\n   💳 Metodi di pagamento:');
      try {
        const fundingSources = await client.getFundingSources(account.id);

        if (fundingSources.length === 0) {
          console.log('      ❌ NESSUN METODO DI PAGAMENTO CONFIGURATO');
          console.log('      ⚠️  QUESTA È LA CAUSA PIÙ COMUNE DEGLI ERRORI "Invalid Parameter"');
          console.log('      📝 Vai su: https://business.facebook.com/settings/payment-methods');
        } else {
          console.log(`      ✅ ${fundingSources.length} metodo(i) configurato(i)`);
          fundingSources.forEach((source: any, idx: number) => {
            console.log(`         ${idx + 1}. ${source.display_string || 'Payment Method'}`);
          });
        }
      } catch (error) {
        console.log('      ⚠️  Impossibile verificare (permessi insufficienti)');
      }

      // Campagne
      console.log('\n   📢 Campagne:');
      try {
        const campaigns = await client.getCampaigns(account.id, { limit: 5 });

        if (campaigns.data.length === 0) {
          console.log('      📭 Nessuna campagna trovata');
        } else {
          console.log(`      ✅ ${campaigns.data.length} campagna(e) (mostrando prime 5)`);
          campaigns.data.slice(0, 5).forEach((campaign: any, idx: number) => {
            console.log(`         ${idx + 1}. ${campaign.name}`);
            console.log(`            ID: ${campaign.id}`);
            console.log(`            Obiettivo: ${campaign.objective}`);
            console.log(`            Status: ${campaign.status}`);

            // Verifica se richiede promoted_object
            const requiresPromoted = [
              'OUTCOME_TRAFFIC',
              'OUTCOME_ENGAGEMENT',
              'OUTCOME_APP_PROMOTION',
              'OUTCOME_LEADS',
              'OUTCOME_SALES',
            ].includes(campaign.objective);

            if (requiresPromoted) {
              console.log(`            ⚠️  Richiede promoted_object per ad set`);
            }
          });
        }
      } catch (error) {
        console.log('      ❌ Errore nel recupero campagne:', error instanceof Error ? error.message : 'Unknown');
      }

      // Ad Sets
      console.log('\n   🎯 Ad Sets:');
      try {
        const adSets = await client.getAdSets({ accountId: account.id, limit: 5 });

        if (adSets.data.length === 0) {
          console.log('      📭 Nessun ad set trovato');
        } else {
          console.log(`      ✅ ${adSets.data.length} ad set(s)`);
          adSets.data.forEach((adSet: any, idx: number) => {
            console.log(`         ${idx + 1}. ${adSet.name} - ${adSet.status}`);
          });
        }
      } catch (error) {
        console.log('      ⚠️  Errore nel recupero ad sets');
      }

      console.log('\n' + '-'.repeat(50) + '\n');
    }

    // Riepilogo
    console.log('\n📋 RIEPILOGO DIAGNOSI\n');

    const hasPaymentMethods = accounts.some(async (account) => {
      try {
        const fundingSources = await client.getFundingSources(account.id);
        return fundingSources.length > 0;
      } catch {
        return false;
      }
    });

    console.log('Problemi identificati:');

    let hasIssues = false;

    // Controlla metodi di pagamento
    for (const account of accounts) {
      try {
        const fundingSources = await client.getFundingSources(account.id);
        if (fundingSources.length === 0) {
          console.log(`❌ Account "${account.name}" non ha metodi di pagamento`);
          hasIssues = true;
        }
      } catch {
        // Skip se non abbiamo permessi
      }
    }

    // Controlla account status
    const inactiveAccounts = accounts.filter(acc => acc.account_status !== 1);
    if (inactiveAccounts.length > 0) {
      console.log(`❌ ${inactiveAccounts.length} account non attivi`);
      hasIssues = true;
    }

    if (!hasIssues) {
      console.log('✅ Nessun problema critico identificato');
      console.log('\nSe continui ad avere errori "Invalid Parameter":');
      console.log('1. Verifica che la campagna abbia l\'obiettivo corretto');
      console.log('2. Fornisci promoted_object se richiesto dall\'obiettivo');
      console.log('3. Usa budget >= 1000 cents ($10)');
      console.log('4. Controlla combinazione optimization_goal + billing_event');
    } else {
      console.log('\n⚠️  Risolvi i problemi sopra prima di creare ad set');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Diagnosi completata\n');

  } catch (error) {
    console.log('\n❌ ERRORE DURANTE LA DIAGNOSI\n');
    console.error(error);
  }
}

diagnoseAccount().catch(console.error);
