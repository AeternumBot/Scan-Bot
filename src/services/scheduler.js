// src/services/scheduler.js
// Cron jobs para la V3:
//   - Recordatorios de tareas cada 2 días
//   - Alertas de capítulos estancados por proyecto
//   - Vencimiento de ausencias
// ────────────────────────────────────────────────────────────────────────────

const cron   = require('node-cron');
const { Tareas, Ausencias, Projects } = require('../utils/storage');
const logger = require('../utils/logger');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  feliz:   () => pick(['(◕‿◕✿)', '(ﾉ◕ヮ◕)ﾉ', '(*´▽`*)']),
  timida:  () => pick(['(〃>_<;〃)', '(/ω＼)', '(〃ω〃)']),
  triste:  () => pick(['(;ω;)', '(´；ω；`)', '(╥_╥)']),
  tranqui: () => pick(['(˘ω˘)', '(っ˘ω˘ς)', '(￣▽￣)']),
};

let _client = null;

// ── Helpers para obtener canales configurados ─────────────────────────────────

function getChannel(client, envKey) {
  const id = process.env[envKey];
  if (!id) return null;
  return client.channels.cache.get(id) || null;
}

async function fetchChannel(client, envKey) {
  const id = process.env[envKey];
  if (!id) return null;
  try {
    return await client.channels.fetch(id);
  } catch {
    return null;
  }
}

// ── Recordatorios de tareas (cada 2 días) ─────────────────────────────────────

async function checkTareas() {
  if (!_client) return;
  const canal = await fetchChannel(_client, 'TASKS_CHANNEL_ID');
  if (!canal) {
    logger.warn('Scheduler', 'TASKS_CHANNEL_ID no configurado, saltando recordatorios de tareas');
    return;
  }

  const ahora     = Date.now();
  const DOS_DIAS  = 2 * 24 * 60 * 60 * 1000;
  const tareas    = Tareas.listActivas();

  for (const tarea of tareas) {
    const ultimoRecordatorio = new Date(tarea.ultimoRecordatorio).getTime();
    if (ahora - ultimoRecordatorio < DOS_DIAS) continue;

    // Calcular cuántos días lleva la tarea activa
    const diasActiva = Math.floor((ahora - new Date(tarea.creadoAt).getTime()) / (24 * 60 * 60 * 1000));

    const mensajes = [
      `E-eh... <@${tarea.asignadoId}>, ¿cómo va la **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}**? ${K.timida()} Ya van **${diasActiva} días** desde que fue asignada. ¡Tú puedes!`,
      `H-hola <@${tarea.asignadoId}>... ${K.tranqui()} Solo pasaba a recordarte que la **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}** sigue pendiente. (${diasActiva} días y contando)`,
      `¡<@${tarea.asignadoId}>! ${K.feliz()} Recordatorio amistoso: la **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}** todavía está en tu lista. ¿Va bien?`,
      `M-mira <@${tarea.asignadoId}>... ${K.triste()} no quiero ser pesada pero ya van **${diasActiva} días** con la **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}**. ¿Necesitas ayuda?`,
    ];

    try {
      await canal.send(pick(mensajes));
      Tareas.actualizarRecordatorio(tarea.id);
      logger.info('Scheduler', `Recordatorio enviado: tarea ${tarea.id} → ${tarea.asignadoName}`);
    } catch (err) {
      logger.error('Scheduler', `Error enviando recordatorio tarea ${tarea.id}: ${err.message}`);
    }
  }
}

// ── Alertas de capítulos estancados ──────────────────────────────────────────

async function checkEstancados() {
  if (!_client) return;
  const canalRegistros = await fetchChannel(_client, 'RECORDS_CHANNEL_ID');
  const MOD_ROLE_ID    = process.env.MOD_ROLE_ID || '1368818622750789633';

  const proyectos = Projects.list().filter(p => p.active && p.staleAlertDays);

  for (const project of proyectos) {
    if (!project.staleAlertDays) continue;
    // La alerta de estancamiento se integra en /status
    // Aquí solo enviamos notificación al canal de registros si supera el umbral
    // La lógica de detección real está en driveService, aquí solo notificamos
    // si el proyecto tiene alertas activadas y hay capítulos estancados en cache

    const { DriveCache } = require('../utils/storage');
    const cached = DriveCache.get(`${project.category || 'any'}__${project.driveFolder}`);
    if (!cached?.chapters) continue;

    const ahora         = Date.now();
    const umbralMs      = project.staleAlertDays * 24 * 60 * 60 * 1000;
    const estancados    = [];

    for (const cap of cached.chapters) {
      // Capítulo estancado: existe pero su última modificación supera el umbral
      // Usamos modifiedTime de las carpetas si está disponible
      if (cap.modifiedTime) {
        const diff = ahora - new Date(cap.modifiedTime).getTime();
        if (diff > umbralMs && !cap.stages?.final?.done) {
          estancados.push(cap.number);
        }
      }
    }

    if (!estancados.length) continue;
    if (!canalRegistros) continue;

    // Verificar si ya notificamos recientemente (evitar spam)
    const ultimaAlerta = project.ultimaAlertaEstancado;
    if (ultimaAlerta && ahora - new Date(ultimaAlerta).getTime() < 24 * 60 * 60 * 1000) continue;

    try {
      await canalRegistros.send(
        `⚠️ <@&${MOD_ROLE_ID}> — **${project.name}** tiene capítulos sin completar hace más de **${project.staleAlertDays} días**: ${estancados.map(n => `Cap. ${n}`).join(', ')} ${K.triste()}\n*Pueden revisar el estado con \`/status\` o via el agente.*`
      );
      // Guardar timestamp de última alerta
      project.ultimaAlertaEstancado = new Date().toISOString();
      Projects.save(project);
    } catch (err) {
      logger.error('Scheduler', `Error alerta estancado ${project.name}: ${err.message}`);
    }
  }
}

// ── Vencimiento de ausencias ──────────────────────────────────────────────────

async function checkAusencias() {
  if (!_client) return;
  const canalAusencias  = await fetchChannel(_client, 'ABSENCES_CHANNEL_ID');
  const canalRegistros  = await fetchChannel(_client, 'RECORDS_CHANNEL_ID');
  const MOD_ROLE_ID     = process.env.MOD_ROLE_ID || '1368818622750789633';

  const ausencias = Ausencias.listActivas();
  const ahora     = Date.now();

  for (const ausencia of ausencias) {
    const hasta = new Date(ausencia.hasta).getTime();
    if (ahora < hasta) continue; // aún no venció
    if (ausencia.notificado) continue; // ya se notificó

    try {
      // 1. Notificar en canal de registros con ping a moderadores
      if (canalRegistros) {
        const mensajes = [
          `<@&${MOD_ROLE_ID}> — La ausencia de **${ausencia.usuarioName}** ha vencido hoy ${K.tranqui()} Era hasta <t:${Math.floor(hasta/1000)}:D>. Por favor comuníquense con él/ella para confirmar su regreso.`,
          `<@&${MOD_ROLE_ID}> — ¡Recordatorio! **${ausencia.usuarioName}** debería estar de vuelta hoy ${K.feliz()} Su ausencia venció. ¿Alguien puede contactarle?`,
          `<@&${MOD_ROLE_ID}> — La ausencia registrada de **${ausencia.usuarioName}** llegó a su fecha límite ${K.timida()} Fecha: <t:${Math.floor(hasta/1000)}:D>. Se recomienda hacer seguimiento.`,
        ];
        await canalRegistros.send(pick(mensajes));
      }

      // 2. Actualizar mensaje en canal de ausencias si existe
      if (canalAusencias && ausencia.mensajeId) {
        try {
          const msg = await canalAusencias.messages.fetch(ausencia.mensajeId);
          if (msg) {
            await msg.edit(
              `~~${msg.content}~~\n✅ **Ausencia vencida** — <t:${Math.floor(ahora/1000)}:f>`
            );
          }
        } catch { /* mensaje ya no existe */ }
      }

      // 3. Marcar como vencida
      Ausencias.marcarVencida(ausencia.id);
      logger.info('Scheduler', `Ausencia vencida notificada: ${ausencia.usuarioName}`);
    } catch (err) {
      logger.error('Scheduler', `Error procesando ausencia ${ausencia.id}: ${err.message}`);
    }
  }
}

// ── Inicio ────────────────────────────────────────────────────────────────────

function start(client) {
  _client = client;

  // Tareas: revisar cada 6 horas
  cron.schedule('0 */6 * * *', () => {
    checkTareas().catch(err => logger.error('Scheduler', `checkTareas error: ${err.message}`));
  }, { timezone: 'America/Bogota' });

  // Ausencias: revisar cada hora
  cron.schedule('0 * * * *', () => {
    checkAusencias().catch(err => logger.error('Scheduler', `checkAusencias error: ${err.message}`));
  }, { timezone: 'America/Bogota' });

  // Estancados: revisar una vez al día a las 9am
  cron.schedule('0 9 * * *', () => {
    checkEstancados().catch(err => logger.error('Scheduler', `checkEstancados error: ${err.message}`));
  }, { timezone: 'America/Bogota' });

  logger.info('Scheduler', '✅ Scheduler V3 iniciado (tareas, ausencias, estancados)');
}

module.exports = { start, checkTareas, checkAusencias, checkEstancados };
