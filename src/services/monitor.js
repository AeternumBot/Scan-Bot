// src/services/monitor.js
// Programador que verifica nuevos capítulos en TMO y Colorcito
// y dispara anuncios en Discord cuando detecta cambios.

const cron    = require('node-cron');
const { Projects, LastChapters } = require('../utils/storage');
const tmo       = require('./tmoScraper');
const colorcito = require('./colorcito');
const logger    = require('../utils/logger');
const announcer = require('./announcer');

const SOURCES = { tmo, colorcito };

let _client = null;
let _job    = null;

// ── Lógica principal ──────────────────────────────────────────────────────────

async function checkProject(project) {
  for (const [source, scraper] of Object.entries(SOURCES)) {
    const url = project.sources?.[source];
    if (!url) continue; // este proyecto no tiene esa fuente

    try {
      const data = await scraper.getLatestChapter(url);
      if (!data?.chapterNum) continue;

      const last = LastChapters.get(project.id, source);

      // Considerar "nuevo" si el número de capítulo cambió
      const isNew = !last || String(data.chapterNum) !== String(last.chapterNum);

      if (isNew) {
        logger.success('Monitor', `Nuevo cap. en [${source}] ${project.name} → Cap. ${data.chapterNum}`);

        // Guardar como último capítulo visto ANTES de anunciar (evita doble anuncio si hay error)
        LastChapters.set(project.id, source, {
          chapterNum: data.chapterNum,
          chapterUrl: data.chapterUrl,
        });

        // Anuncio automático desactivado — usar /anunciar manualmente
        await logger.discord(_client, 'info', 'Monitor', `Nuevo cap. detectado: **${project.name}** cap. ${data.chapterNum} [${source}] — pendiente de anuncio manual`);
      }
    } catch (err) {
      logger.error('Monitor', `Error chequeando ${project.name} [${source}]: ${err.message}`);
    }

    // Pequeña pausa entre requests para no saturar los servidores
    await sleep(2000);
  }
}

async function checkAllProjects() {
  const projects = Projects.list().filter(p => p.active);

  if (!projects.length) {
    logger.info('Monitor', 'No hay proyectos activos configurados.');
    return;
  }

  logger.info('Monitor', `Verificando ${projects.length} proyectos...`);

  for (const project of projects) {
    await checkProject(project);
  }

  logger.info('Monitor', 'Ciclo completado ✓');
}

// ── Control del scheduler ─────────────────────────────────────────────────────

function start(client) {
  _client = client;

  const minutes = parseInt(process.env.CHECK_INTERVAL_MINUTES || '25', 10);
  const cronExpr = `*/${minutes} * * * *`; // cada N minutos

  logger.info('Monitor', `Iniciando scheduler: cada ${minutes} minutos (cron: ${cronExpr})`);

  // Primera verificación al iniciar (después de 10 seg para dejar que Discord conecte)
  setTimeout(() => checkAllProjects(), 10_000);

  _job = cron.schedule(cronExpr, checkAllProjects, {
    timezone: process.env.TIMEZONE || 'America/Bogota',
  });
}

function stop() {
  if (_job) {
    _job.stop();
    _job = null;
    logger.info('Monitor', 'Scheduler detenido.');
  }
}

/** Fuerza una verificación inmediata (útil desde un comando de admin) */
async function forceCheck(client) {
  _client = client || _client;
  await checkAllProjects();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { start, stop, forceCheck };
