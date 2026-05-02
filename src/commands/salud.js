// src/commands/salud.js
// /salud — Lumi se autodiagnostica y reporta su estado

const { SlashCommandBuilder } = require('discord.js');
const LUMI = require('../utils/lumi');
const { K } = require('../utils/lumi');
const { Projects } = require('../utils/storage');
const driveService = require('../services/driveService');
const colorcito = require('../services/colorcito');

const data = new SlashCommandBuilder()
  .setName('salud')
  .setDescription('Diagnóstico completo del sistema');

async function execute(interaction) {
  await interaction.deferReply();

  const checks = [];
  let todosBien = true;

  // ── 1. Discord ────────────────────────────────────────────────────────────
  const ping = interaction.client.ws.ping;
  if (ping < 200) {
    checks.push(`✅ Conexión con Discord estable — **${ping}ms** ${K.social()}`);
  } else if (ping < 500) {
    checks.push(`⚠️ Conexión con Discord lenta — **${ping}ms** ${K.hartazgo()} Algo no está del todo bien.`);
    todosBien = false;
  } else {
    checks.push(`❌ Conexión con Discord muy lenta — **${ping}ms** ${K.triste()} Esto es inaceptable.`);
    todosBien = false;
  }

  // ── 2. Variables de entorno ───────────────────────────────────────────────
  const varsRequeridas = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID', 'GDRIVE_ROOT_FOLDER_ID'];
  const varsFaltantes = varsRequeridas.filter(v => !process.env[v]);
  if (varsFaltantes.length === 0) {
    checks.push(`✅ Variables de configuración en orden ${K.altiva()}`);
  } else {
    checks.push(`❌ Faltan variables: \`${varsFaltantes.join(', ')}\` ${K.triste()} Esto debe corregirse.`);
    todosBien = false;
  }

  // ── 3. Google Drive ───────────────────────────────────────────────────────
  try {
    await driveService.listFolder(process.env.GDRIVE_ROOT_FOLDER_ID);
    checks.push(`✅ Conexión con Google Drive operativa ${K.social()}`);
  } catch (err) {
    checks.push(`❌ No hay conexión con Google Drive ${K.triste()} \`${err.message}\``);
    todosBien = false;
  }

  // ── 4. Proyectos ──────────────────────────────────────────────────────────
  const proyectos = Projects.list();
  const activos = proyectos.filter(p => p.active).length;
  checks.push(`✅ **${proyectos.length}** proyecto(s) registrado(s), **${activos}** activo(s) ${K.altiva()}`);

  // ── 5. Scrapers ───────────────────────────────────────────────────────────
  const proyectoConColor = proyectos.find(p => p.sources?.colorcito);
  if (proyectoConColor) {
    try {
      const result = await Promise.race([
        colorcito.getLatestChapter(proyectoConColor.sources.colorcito),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      if (result) {
        checks.push(`✅ Scraper de Colorcito respondiendo correctamente ${K.social()}`);
      } else {
        checks.push(`⚠️ Scraper de Colorcito respondió pero sin datos ${K.hartazgo()}`);
        todosBien = false;
      }
    } catch {
      checks.push(`❌ Sin conexión con Colorcito ${K.triste()}`);
      todosBien = false;
    }
  } else {
    checks.push(`ℹ️ No hay proyectos con Colorcito para probar el scraper`);
  }

  // ── Respuesta final ───────────────────────────────────────────────────────
  const intro = todosBien
    ? `Diagnóstico completo. Todo está en orden ${K.altiva()}\n\n`
    : `Diagnóstico completo. Hay elementos que requieren atención ${K.hartazgo()}\n\n`;

  const cierre = todosBien
    ? `\n*Sistema operativo al nivel esperado ${K.social()}*`
    : `\n*Se recomienda revisar los puntos marcados ${K.triste()}*`;

  await interaction.editReply({
    content: intro + checks.join('\n') + cierre,
  });
}

module.exports = { data, execute };
