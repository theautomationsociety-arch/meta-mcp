#!/usr/bin/env tsx

/**
 * Script per ottenere gli ID delle Facebook Pages accessibili
 */

import { AuthManager } from './src/utils/auth.js';

async function getPageIds() {
  console.log('🔍 Recupero Facebook Pages...\n');

  try {
    const auth = AuthManager.fromEnvironment();
    const token = auth.getAccessToken();
    const apiVersion = auth.getApiVersion();

    // Get user's pages
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/me/accounts?fields=id,name,category,access_token&access_token=${token}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error, null, 2));
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.log('❌ Nessuna Facebook Page trovata');
      console.log('\nPossibili cause:');
      console.log('1. Non hai ancora creato una Facebook Page');
      console.log('2. Non hai i permessi "pages_read_engagement" sul token');
      console.log('3. Il token non è associato all\'account corretto');
      console.log('\n💡 Vai su https://www.facebook.com/pages/create per creare una Page');
      return;
    }

    console.log(`✅ Trovate ${data.data.length} Facebook Page(s):\n`);

    data.data.forEach((page: any, index: number) => {
      console.log(`${index + 1}. 📄 ${page.name}`);
      console.log(`   Page ID: ${page.id}`);
      console.log(`   Categoria: ${page.category}`);
      console.log('');
    });

    console.log('📋 Per usare nel test, copia uno dei Page ID sopra');
    console.log('\nEsempio:');
    console.log('promoted_object: {');
    console.log(`  page_id: "${data.data[0].id}"`);
    console.log('}');

  } catch (error) {
    console.log('❌ Errore durante il recupero delle Pages\n');
    if (error instanceof Error) {
      console.log(error.message);
    }
  }
}

getPageIds().catch(console.error);
