/**
 * @file verify-connection.js
 * @description Diagnostic script to verify real Supabase connectivity,
 * RLS policies on `hall_of_fame`, and Storage bucket access for `reactions`.
 * Standards: UK English (en-GB), Node.js native fetch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envLocalPath = path.resolve(__dirname, '../src/env.local.js');

let supabaseUrl = process.env.SUPABASE_URL;
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// If not in environment, attempt to parse from src/env.local.js
if ((!supabaseUrl || !supabaseAnonKey) && fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  const urlMatch = content.match(/SUPABASE_URL\s*:\s*['"`]([^'"`]+)['"`]/);
  const keyMatch = content.match(/SUPABASE_ANON_KEY\s*:\s*['"`]([^'"`]+)['"`]/);

  if (urlMatch && urlMatch[1]) supabaseUrl = urlMatch[1].trim();
  if (keyMatch && keyMatch[1]) supabaseAnonKey = keyMatch[1].trim();
}

console.log('\n======================================================');
console.log('🎃 DAWlloween Supabase Connection Diagnostic Tool');
console.log('======================================================\n');

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project') || supabaseAnonKey.includes('placeholder')) {
  console.error('❌ Credentials not detected or still contain placeholders.');
  console.error('   Please configure your credentials in `src/env.local.js`:');
  console.error(`   window.__ENV__ = {\n     SUPABASE_URL: 'https://xyz.supabase.co',\n     SUPABASE_ANON_KEY: 'eyJ...'\n   };\n`);
  process.exit(1);
}

const cleanBaseUrl = supabaseUrl.replace(/\/+$/, '');
const authHeaders = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json'
};

async function runDiagnostics() {
  let hasErrors = false;

  console.log(`📡 Target Supabase URL: ${cleanBaseUrl}`);
  console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 16)}...[REDACTED]\n`);

  // 1. Test database table connectivity and SELECT RLS policy
  console.log('1️⃣  Checking Database Table `hall_of_fame` (SELECT)...');
  try {
    const tableUrl = `${cleanBaseUrl}/rest/v1/hall_of_fame?select=id,nickname,created_at&limit=1`;
    const res = await fetch(tableUrl, { headers: authHeaders });

    if (res.ok) {
      const data = await res.json();
      console.log('   ✅ Table `hall_of_fame` is accessible. Current row count sampled:', data.length);
    } else {
      hasErrors = true;
      const text = await res.text();
      console.error(`   ❌ Failed to query \`hall_of_fame\` (HTTP ${res.status}): ${text}`);
      if (res.status === 404) {
        console.error('      -> Table does not exist. Did you run the SQL migration?');
      } else if (res.status === 401 || res.status === 403) {
        console.error('      -> RLS policy or API key issue. Verify SELECT policy for role `anon`.');
      }
    }
  } catch (err) {
    hasErrors = true;
    console.error('   ❌ Network error connecting to Supabase database:', err.message);
  }

  // 2. Test database INSERT RLS policy with a temporary verification record
  console.log('\n2️⃣  Testing Database INSERT on `hall_of_fame`...');
  const testId = `diag-${Date.now()}`;
  try {
    const insertUrl = `${cleanBaseUrl}/rest/v1/hall_of_fame`;
    const testPayload = {
      nickname: 'DiagnosticGhost',
      video_url: 'https://example.com/test-reaction.webm',
      photo_url: null
    };

    const res = await fetch(insertUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify(testPayload)
    });

    if (res.ok || res.status === 201) {
      const inserted = await res.json();
      const record = Array.isArray(inserted) ? inserted[0] : inserted;
      console.log('   ✅ Inserción completada con éxito. ID creado:', record?.id || 'OK');

      // Cleanup test row if possible
      if (record?.id) {
        try {
          await fetch(`${cleanBaseUrl}/rest/v1/hall_of_fame?id=eq.${record.id}`, {
            method: 'DELETE',
            headers: authHeaders
          });
        } catch {
          // Non-critical cleanup
        }
      }
    } else {
      hasErrors = true;
      const text = await res.text();
      console.error(`   ❌ Insertion failed (HTTP ${res.status}): ${text}`);
      console.error('      -> Check INSERT policy for role `anon` in table `hall_of_fame`.');
    }
  } catch (err) {
    hasErrors = true;
    console.error('   ❌ Network error during database insertion test:', err.message);
  }

  // 3. Test Storage Bucket `reactions`
  console.log('\n3️⃣  Checking Storage Bucket `reactions` (Upload & Public URL)...');
  try {
    const testFileName = `test_ping_${Date.now()}.txt`;
    const uploadUrl = `${cleanBaseUrl}/storage/v1/object/reactions/${testFileName}`;
    const testContent = 'DAWlloween storage ping test';

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'text/plain'
      },
      body: testContent
    });

    if (uploadRes.ok || uploadRes.status === 200 || uploadRes.status === 201) {
      console.log('   ✅ Archivo de prueba subido correctamente al bucket `reactions`.');
      const publicUrl = `${cleanBaseUrl}/storage/v1/object/public/reactions/${testFileName}`;
      console.log(`   🔗 Public URL: ${publicUrl}`);

      // Verify public retrieval
      const getRes = await fetch(publicUrl);
      if (getRes.ok) {
        console.log('   ✅ Bucket público verificado: el archivo se descarga públicamente sin autenticación.');
      } else {
        console.warn(`   ⚠️ El archivo se subió pero no es accesible públicamente (HTTP ${getRes.status}). Revisa que el bucket sea público.`);
      }

      // Cleanup test file
      try {
        await fetch(`${cleanBaseUrl}/storage/v1/object/reactions`, {
          method: 'DELETE',
          headers: authHeaders,
          body: JSON.stringify({ prefixes: [testFileName] })
        });
      } catch {
        // Non-critical cleanup
      }
    } else {
      hasErrors = true;
      const text = await uploadRes.text();
      console.error(`   ❌ Failed to upload to bucket \`reactions\` (HTTP ${uploadRes.status}): ${text}`);
      console.error('      -> Make sure the bucket `reactions` exists and has an INSERT policy for `anon`.');
    }
  } catch (err) {
    hasErrors = true;
    console.error('   ❌ Network error during storage bucket test:', err.message);
  }

  console.log('\n======================================================');
  if (hasErrors) {
    console.log('❌ DIAGNOSTIC RESULT: Some checks failed. Check the errors above.');
    process.exit(1);
  } else {
    console.log('🎉 DIAGNOSTIC RESULT: All Supabase checks PASSED! Connection is fully operational.');
    console.log('======================================================\n');
  }
}

runDiagnostics();
