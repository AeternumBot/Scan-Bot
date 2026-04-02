/**
 * scripts/get-oauth-token.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Script de UN SOLO USO para obtener el refresh_token de OAuth2.
 * Corre esto en tu PC, autoriza con tu cuenta de Google, y copia el token
 * resultante a las variables de entorno de Railway.
 *
 * ANTES DE CORRER ESTE SCRIPT:
 *   1. Ve a https://console.cloud.google.com
 *   2. Proyecto → APIs y servicios → Credenciales → "Crear credenciales" → "ID de cliente OAuth 2.0"
 *   3. Tipo: "Aplicación de escritorio"
 *   4. Descarga el JSON o copia el Client ID y Client Secret
 *   5. En "URIs de redireccionamiento autorizados" asegúrate de tener:
 *      http://localhost:3001/callback
 *   6. Llena las variables de abajo con tu Client ID y Client Secret
 *
 * CÓMO CORRER:
 *   node scripts/get-oauth-token.js
 *
 * Luego abre la URL que aparece en consola, autoriza y el token se imprimirá.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── CONFIGURA ESTO ────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || 'PEGA_TU_CLIENT_ID_AQUI';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'PEGA_TU_CLIENT_SECRET_AQUI';
// ─────────────────────────────────────────────────────────────────────────────

const { google }   = require('googleapis');
const http         = require('http');
const url          = require('url');
const readline     = require('readline');

const REDIRECT_URI = 'http://localhost:3001/callback';
const SCOPES       = ['https://www.googleapis.com/auth/drive'];

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',   // necesario para obtener refresh_token
  prompt:      'consent',   // fuerza a mostrar el refresh_token aunque ya hayas autorizado
  scope:       SCOPES,
});

console.log('\n─────────────────────────────────────────────────────────');
console.log('  🔑 Obteniendo token OAuth2 para Google Drive');
console.log('─────────────────────────────────────────────────────────');
console.log('\n1. Abre esta URL en tu navegador:\n');
console.log('   ' + authUrl);
console.log('\n2. Autoriza con la cuenta de Google donde están tus proyectos.');
console.log('3. Espera... el token aparecerá aquí automáticamente.\n');

// Servidor local temporal para capturar el callback de Google
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname !== '/callback') {
    res.end('Ignorado');
    return;
  }

  const code = parsed.query.code;
  if (!code) {
    res.end('❌ No se recibió el código de autorización.');
    server.close();
    return;
  }

  res.end('<h2>✅ ¡Autorizado! Puedes cerrar esta ventana.</h2><p>Copia el token que apareció en la consola.</p>');

  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log('\n─────────────────────────────────────────────────────────');
    console.log('  ✅ ¡Token obtenido exitosamente!');
    console.log('─────────────────────────────────────────────────────────\n');
    console.log('Agrega estas variables en Railway (Settings → Variables):\n');
    console.log(`  GOOGLE_CLIENT_ID     = ${CLIENT_ID}`);
    console.log(`  GOOGLE_CLIENT_SECRET = ${CLIENT_SECRET}`);
    console.log(`  GOOGLE_REFRESH_TOKEN = ${tokens.refresh_token}`);
    console.log('\n─────────────────────────────────────────────────────────');

    if (!tokens.refresh_token) {
      console.log('\n⚠️  No se obtuvo refresh_token. Esto pasa si ya habías autorizado antes.');
      console.log('   Solución: ve a https://myaccount.google.com/permissions');
      console.log('   Revoca el acceso a tu app y vuelve a correr este script.\n');
    }
  } catch (err) {
    console.error('\n❌ Error obteniendo el token:', err.message);
  }

  server.close();
});

server.listen(3001, () => {
  // Servidor escuchando, esperando el callback
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n❌ El puerto 3001 está en uso. Cierra el proceso que lo usa e intenta de nuevo.');
  } else {
    console.error('\n❌ Error en el servidor:', err.message);
  }
  process.exit(1);
});
