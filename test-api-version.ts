#!/usr/bin/env tsx

/**
 * Test script per verificare compatibilità tra versioni API Meta
 *
 * Testa che l'applicazione funzioni correttamente con:
 * - v23.0 (versione precedente)
 * - v24.0 (versione attuale)
 */

import { MetaApiClient } from './src/meta-client.js';
import { AuthManager } from './src/utils/auth.js';

async function testApiVersion(version: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Meta API ${version}`);
  console.log('='.repeat(60));

  try {
    // Create auth manager with specific version
    const auth = new AuthManager({
      accessToken: process.env.META_ACCESS_TOKEN || '',
      apiVersion: version,
    });

    const client = new MetaApiClient(auth);

    console.log(`✅ Using API version: ${auth.getApiVersion()}`);
    console.log(`✅ Base URL: ${auth.getBaseUrl()}`);

    // Test 1: Get ad accounts
    console.log('\n1️⃣ Testing: Get Ad Accounts');
    const accounts = await client.getAdAccounts();
    console.log(`   ✅ SUCCESS: Found ${accounts.length} account(s)`);

    if (accounts.length > 0) {
      const account = accounts[0];
      console.log(`   📊 Account: ${account.name} (${account.id})`);

      // Test 2: Get campaigns
      console.log('\n2️⃣ Testing: Get Campaigns');
      const campaigns = await client.getCampaigns(account.id, { limit: 3 });
      console.log(`   ✅ SUCCESS: Found ${campaigns.data.length} campaign(s)`);

      // Test 3: Get ad sets
      console.log('\n3️⃣ Testing: Get Ad Sets');
      const adSets = await client.getAdSets({ accountId: account.id, limit: 3 });
      console.log(`   ✅ SUCCESS: Found ${adSets.data.length} ad set(s)`);

      // Test 4: Validate token
      console.log('\n4️⃣ Testing: Token Validation');
      const isValid = await auth.validateToken();
      console.log(`   ${isValid ? '✅' : '❌'} Token is ${isValid ? 'valid' : 'invalid'}`);
    }

    console.log(`\n✅ All tests passed for ${version}!`);
    return true;

  } catch (error) {
    console.log(`\n❌ Error testing ${version}:`);
    if (error instanceof Error) {
      console.log(`   ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('🔍 Meta API Version Compatibility Test\n');

  if (!process.env.META_ACCESS_TOKEN) {
    console.log('❌ META_ACCESS_TOKEN not set');
    console.log('\nUsage:');
    console.log('  export META_ACCESS_TOKEN="your_token_here"');
    console.log('  npx tsx test-api-version.ts');
    process.exit(1);
  }

  // Test v23.0
  const v23works = await testApiVersion('v23.0');

  // Test v24.0
  const v24works = await testApiVersion('v24.0');

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log(`v23.0: ${v23works ? '✅ Compatible' : '❌ Not compatible'}`);
  console.log(`v24.0: ${v24works ? '✅ Compatible' : '❌ Not compatible'}`);

  if (v23works && v24works) {
    console.log('\n✅ Both versions are compatible!');
    console.log('   You can safely use either v23.0 or v24.0');
    console.log('   v24.0 is recommended for latest features');
  } else if (v24works) {
    console.log('\n✅ v24.0 works - use this version');
  } else if (v23works) {
    console.log('\n⚠️  Only v23.0 works - may need to stay on this version');
  } else {
    console.log('\n❌ Neither version works - check your token');
  }

  console.log('');
}

main().catch(console.error);
