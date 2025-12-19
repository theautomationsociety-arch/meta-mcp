#!/usr/bin/env tsx

/**
 * Script per verificare i ruoli e permessi su una specifica Facebook Page
 */

import { AuthManager } from './src/utils/auth.js';

const PAGE_ID = '203154550112460'; // Voglia Maligna

async function checkPageRoles() {
  console.log('🔍 VERIFICA RUOLI FACEBOOK PAGE\n');
  console.log('='.repeat(70));

  try {
    const auth = AuthManager.fromEnvironment();
    const token = auth.getAccessToken();
    const apiVersion = auth.getApiVersion();

    console.log(`\n📄 Page ID: ${PAGE_ID}\n`);

    // 1. Ottieni informazioni sulla page
    console.log('1️⃣ INFORMAZIONI PAGE');
    console.log('-'.repeat(70));

    const pageInfoResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${PAGE_ID}?fields=name,category,is_published,is_verified,access_token&access_token=${token}`
    );
    const pageInfo = await pageInfoResponse.json();

    if (pageInfo.error) {
      console.log('❌ Errore nel recupero info page:');
      console.log(JSON.stringify(pageInfo.error, null, 2));
      console.log('\n⚠️  Possibile causa: Non hai accesso a questa page');
      return;
    }

    console.log(`✅ Nome: ${pageInfo.name}`);
    console.log(`   Categoria: ${pageInfo.category}`);
    console.log(`   Pubblicata: ${pageInfo.is_published ? 'Sì' : 'No'}`);
    console.log(`   Verificata: ${pageInfo.is_verified ? 'Sì' : 'No'}`);

    if (!pageInfo.is_published) {
      console.log('\n⚠️  PROBLEMA: La page non è pubblicata!');
      console.log('   Le page non pubblicate non possono essere usate per pubblicità');
    }

    // 2. Verifica il tuo ruolo sulla page
    console.log('\n\n2️⃣ IL TUO RUOLO SULLA PAGE');
    console.log('-'.repeat(70));

    // Ottieni tutte le pages dell'utente con ruoli
    const myPagesResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/me/accounts?fields=id,name,tasks,access_token&access_token=${token}`
    );
    const myPagesData = await myPagesResponse.json();

    const myPage = myPagesData.data?.find((p: any) => p.id === PAGE_ID);

    if (!myPage) {
      console.log('❌ NON SEI ADMIN/EDITOR DI QUESTA PAGE!');
      console.log('\n📋 Pages di cui sei admin:');
      if (myPagesData.data && myPagesData.data.length > 0) {
        myPagesData.data.forEach((p: any) => {
          console.log(`   - ${p.name} (${p.id})`);
        });
      } else {
        console.log('   Nessuna page trovata');
      }

      console.log('\n💡 SOLUZIONE:');
      console.log('   1. Vai su https://facebook.com/203154550112460/settings');
      console.log('   2. Clicca "Page Roles" nel menu a sinistra');
      console.log('   3. Aggiungi te stesso come "Admin" o "Editor"');
      console.log('   4. Riprova il test');
      return;
    }

    console.log(`✅ Sei admin/editor di questa page`);

    if (myPage.tasks) {
      console.log('\n   📋 I tuoi permessi sulla page:');
      myPage.tasks.forEach((task: string) => {
        const isRequired = ['ADVERTISE', 'ANALYZE', 'CREATE_CONTENT'].includes(task);
        console.log(`      ${isRequired ? '✅' : '  '} ${task}`);
      });

      // Verifica permessi critici
      const requiredTasks = ['ADVERTISE', 'ANALYZE'];
      const hasTasks = requiredTasks.filter(t => myPage.tasks.includes(t));
      const missingTasks = requiredTasks.filter(t => !myPage.tasks.includes(t));

      if (missingTasks.length > 0) {
        console.log('\n   ⚠️  PERMESSI MANCANTI:');
        missingTasks.forEach((task: string) => console.log(`      ❌ ${task}`));
        console.log('\n   💡 Serve il ruolo "Admin" per avere tutti i permessi');
      } else {
        console.log('\n   ✅ Hai tutti i permessi necessari sulla page');
      }
    }

    // 3. Verifica se la page è collegata al Business Manager
    console.log('\n\n3️⃣ BUSINESS MANAGER');
    console.log('-'.repeat(70));

    try {
      const businessResponse = await fetch(
        `https://graph.facebook.com/${apiVersion}/${PAGE_ID}?fields=business&access_token=${token}`
      );
      const businessData = await businessResponse.json();

      if (businessData.business) {
        console.log(`✅ Page collegata a Business Manager: ${businessData.business.name || businessData.business.id}`);
      } else {
        console.log('⚠️  Page NON collegata a un Business Manager');
        console.log('   Questo potrebbe limitare le funzionalità pubblicitarie');
      }
    } catch (error) {
      console.log('ℹ️  Impossibile verificare Business Manager');
    }

    // 4. Test creazione ad creative (permesso più permissivo di ad set)
    console.log('\n\n4️⃣ TEST PERMESSI PUBBLICITÀ');
    console.log('-'.repeat(70));

    console.log('Testando accesso agli ad account...');

    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/me/adaccounts?fields=id,name&access_token=${token}`
    );
    const adAccountsData = await adAccountsResponse.json();

    if (!adAccountsData.data || adAccountsData.data.length === 0) {
      console.log('❌ Nessun account pubblicitario trovato');
    } else {
      const adAccount = adAccountsData.data[0];
      console.log(`✅ Account pubblicitario: ${adAccount.name} (${adAccount.id})`);

      // Verifica che l'account abbia accesso alla page
      console.log('\nVerificando accesso page da account pubblicitario...');

      try {
        const pageAccessResponse = await fetch(
          `https://graph.facebook.com/${apiVersion}/${adAccount.id}/userpermissions?user=${myPage ? myPage.id : PAGE_ID}&access_token=${token}`
        );
        const pageAccessData = await pageAccessResponse.json();

        console.log('Risultato:', JSON.stringify(pageAccessData, null, 2));
      } catch (error) {
        console.log('ℹ️  Impossibile verificare accesso page da ad account');
      }
    }

    // 5. Raccomandazioni finali
    console.log('\n\n5️⃣ RACCOMANDAZIONI');
    console.log('-'.repeat(70));

    if (!myPage) {
      console.log('\n❌ PROBLEMA PRINCIPALE: Non hai ruolo admin/editor sulla page');
      console.log('\n📋 AZIONE RICHIESTA:');
      console.log('1. Vai su: https://facebook.com/203154550112460/settings');
      console.log('2. Menu laterale → "Page access" o "Page roles"');
      console.log('3. Aggiungi il tuo utente come "Admin"');
      console.log('4. Attendi qualche minuto per la propagazione');
      console.log('5. Rigenera il token su Graph API Explorer');
      console.log('6. Riprova il test');
    } else if (!pageInfo.is_published) {
      console.log('\n❌ PROBLEMA PRINCIPALE: Page non pubblicata');
      console.log('\n📋 AZIONE RICHIESTA:');
      console.log('1. Vai su: https://facebook.com/203154550112460/settings');
      console.log('2. Generale → Visibilità page');
      console.log('3. Seleziona "Page published"');
    } else {
      console.log('\n✅ I permessi sulla page sembrano corretti');
      console.log('\nProblema potrebbe essere:');
      console.log('1. La page è nuova (< 1 settimana) → Aspetta qualche giorno');
      console.log('2. Account pubblicitario con restrizioni → Verifica su business.facebook.com');
      console.log('3. Business Manager non configurato → Collega page a Business Manager');
      console.log('\n💡 Prova a:');
      console.log('1. Collegare la page a Business Manager');
      console.log('2. Verificare che l\'account pubblicitario abbia accesso alla page');
      console.log('3. Contattare il supporto Meta se il problema persiste');
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ Analisi completata\n');

  } catch (error) {
    console.log('\n❌ ERRORE\n');
    console.error(error);
  }
}

checkPageRoles().catch(console.error);
