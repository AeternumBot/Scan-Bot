// src/commands/salud.js
// /salud — Sua se autodiagnostica y reporta su estado

const { SlashCommandBuilder } = require('discord.js');
const SUA = require('../utils/sua');
const { Projects } = require('../utils/storage');
const driveService = require('../services/driveService');
const tmoScraper = require('../services/tmoScraper');
const colorcito = require('../services/colorcito');

const data = new SlashCommandBuilder()
  .setName('salud')
  .setDescription('Sua revisa cómo está y te cuenta');

async function execute(interaction) {
  await interaction.deferReply();

  const checks = [];
  let todosBien = true;

  // ── 1. Discord ────────────────────────────────────────────────────────────
  const ping = interaction.client.ws.ping;
  if (ping < 200) {
    checks.push(`✅ Mi conexión con Discord está bien... latencia de **${ping}ms** (っ˘ω˘ς)`);
  } else if (ping < 500) {
    checks.push(`⚠️ Mi conexión con Discord está un poco lenta... **${ping}ms** (〃>_<;〃)`);
    todosBien = false;
  } else {
    checks.push(`❌ Mi conexión con Discord está muy lenta... **${ping}ms** (;ω;)`);
    todosBien = false;
  }

  // ── 2. Variables de entorno ───────────────────────────────────────────────
  const varsRequeridas = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID', 'GDRIVE_ROOT_FOLDER_ID'];
  const varsFaltantes = varsRequeridas.filter(v => !process.env[v]);
  if (varsFaltantes.length === 0) {
    checks.push(`✅ Todas mis variables de configuración están en orden (◕‿◕✿)`);
  } else {
    checks.push(`❌ Me faltan estas variables: \`${varsFaltantes.join(', ')}\` (;ω;)`);
    todosBien = false;
  }

  // ── 3. Google Drive ───────────────────────────────────────────────────────
  try {
    await driveService.listFolder(process.env.GDRIVE_ROOT_FOLDER_ID);
    checks.push(`✅ Mi conexión con Google Drive está bien (◕‿◕✿)`);
  } catch (err) {
    checks.push(`❌ No pude conectarme con Google Drive... (;ω;) \`${err.message}\``);
    todosBien = false;
  }

  // ── 4. Proyectos ──────────────────────────────────────────────────────────
  const proyectos = Projects.list();
  const activos = proyectos.filter(p => p.active).length;
  checks.push(`✅ Tengo **${proyectos.length}** proyecto(s) registrado(s), **${activos}** activo(s) (っ˘ω˘ς)`);

  // ── 5. Scrapers ───────────────────────────────────────────────────────────
  const proyectoConTmo = proyectos.find(p => p.sources?.tmo);
  if (proyectoConTmo) {
    try {
      const result = await Promise.race([
        tmoScraper.getLatestChapter(proyectoConTmo.sources.tmo),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      if (result) {
        checks.push(`✅ El scraper de TMO responde bien (◕‿◕✿)`);
      } else {
        checks.push(`⚠️ El scraper de TMO respondió pero sin datos... (〃>_<;〃)`);
        todosBien = false;
      }
    } catch {
      checks.push(`❌ No pude conectarme con TMO... (;ω;)`);
      todosBien = false;
    }
  } else {
    checks.push(`ℹ️ No hay proyectos con TMO para probar el scraper`);
  }

  const proyectoConColor = proyectos.find(p => p.sources?.colorcito);
  if (proyectoConColor) {
    try {
      const result = await Promise.race([
        colorcito.getLatestChapter(proyectoConColor.sources.colorcito),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      if (result) {
        checks.push(`✅ El scraper de Colorcito responde bien (◕‿◕✿)`);
      } else {
        checks.push(`⚠️ El scraper de Colorcito respondió pero sin datos... (〃>_<;〃)`);
        todosBien = false;
      }
    } catch {
      checks.push(`❌ No pude conectarme con Colorcito... (;ω;)`);
      todosBien = false;
    }
  } else {
    checks.push(`ℹ️ No hay proyectos con Colorcito para probar el scraper`);
  }

  // ── Respuesta final ───────────────────────────────────────────────────────
  const intro = todosBien
    ? `Me revisé bien y... parece que todo está en orden (◕‿◕✿) Me alegra mucho poder decirles eso:\n\n`
    : `E-eh... me revisé y encontré algunas cosas que no están del todo bien (〃>_<;〃) Se los cuento:\n\n`;

  const cierre = todosBien
    ? `\n*Estaré aquí siempre que me necesiten (っ˘ω˘ς)*`
    : `\n*Voy a seguir intentando lo mejor que pueda... disculpen las molestias (´• ω •\`)ゞ*`;

  await interaction.editReply({
    content: intro + checks.join('\n') + cierre,
  });
}

module.exports = { data, execute };
