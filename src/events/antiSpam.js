// src/events/antiSpam.js
// Detecta spam de links e imágenes/archivos y banea automáticamente
// Umbral: 5 mensajes con link/imagen en 5 segundos → ban inmediato
// Aplica en ambos servidores (staff y lectores)
// ────────────────────────────────────────────────────────────────────────────

const { Events } = require('discord.js');
const logger = require('../utils/logger');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ── Config ────────────────────────────────────────────────────────────────────
const UMBRAL_MENSAJES = 5;
const VENTANA_MS      = 5000;

// ── Caché en memoria: userId → array de timestamps ────────────────────────────
const _cache = new Map();

function registrar(userId) {
  const ahora = Date.now();
  const historial = (_cache.get(userId) || []).filter(t => ahora - t < VENTANA_MS);
  historial.push(ahora);
  _cache.set(userId, historial);
  setTimeout(() => {
    const actual = _cache.get(userId) || [];
    if (actual.length === 0) _cache.delete(userId);
  }, VENTANA_MS + 500);
  return historial.length;
}

// ── Detectar si el mensaje tiene link o imagen/archivo ────────────────────────
function esSpam(message) {
  if (message.attachments.size > 0) return true;
  if (/https?:\/\/\S+/i.test(message.content)) return true;
  if (message.embeds.length > 0) return true;
  return false;
}

// ── Frases de Lumi al banear — strings estáticos, pick se llama al usarlas ────
const FRASES_SPAM = [
  'Spam detectado y eliminado (눈_눈) No hay tolerancia para eso aquí.',
  'Ban ejecutado (￣^￣) El servidor tiene estándares. Que se recuerde.',
  'Alguien pensó que podía inundar este servidor sin consecuencias (눈‸눈) Ya no está.',
  'Spam masivo. El usuario fue baneado automáticamente ( ≖.≖) No era difícil comportarse.',
  'El sistema actuó. El servidor sigue en orden ( ´ ▽ ` )b Como debe ser.',
  'Se detectó spam y fue neutralizado (눈_눈) Mis estándares no negocian.',
  'Ban aplicado por spam ╮(╯_╰)╭ Si no puedes contribuir, no puedes estar aquí.',
  '¿Spam? ( ≖.≖) Esperaba algo así eventualmente. Ya fue baneado.',
  'El intruso fue eliminado ( -_ -)✧ El servidor está seguro.',
  'Spam detectado. Usuario baneado (ㆆ_ㆆ) No requiere más comentario.',
  'Actuación automática completada (눈‸눈) No se toleran este tipo de comportamientos.',
  'Ban inmediato por spam ( ¬ _ ¬ ) Hay reglas por una razón.',
  'Usuario eliminado del servidor (￣^￣) El orden se mantiene.',
  'Spam contenido y baneado (-‸ლ) Ojalá hubiera algo más inteligente que hacer.',
];

// ── Notificar en canal de logs ─────────────────────────────────────────────────
async function notificar(guild, message, username) {
  const frase = pick(FRASES_SPAM);
  const logChannelId = process.env.LOG_CHANNEL_ID || process.env.RECORDS_CHANNEL_ID;

  if (logChannelId) {
    try {
      const canal = await guild.channels.fetch(logChannelId).catch(() => null);
      if (canal?.isTextBased()) {
        await canal.send(`🚨 **Anti-spam** — **${username}** fue baneado automáticamente.\n${frase}`);
        return;
      }
    } catch { /* fallback al canal del mensaje */ }
  }

  try {
    await message.channel.send(frase);
  } catch { /* si el canal ya fue bloqueado, no importa */ }
}

// ── Handler principal ─────────────────────────────────────────────────────────
module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild)     return;
    if (!message.member)    return;

    const staffGuildId  = process.env.DISCORD_GUILD_ID;
    const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
    const guildId = message.guild.id;
    if (guildId !== staffGuildId && guildId !== readerGuildId) return;

    const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1368818622750789633';
    if (message.member.permissions.has('Administrator')) return;
    if (message.member.permissions.has('ManageGuild'))   return;
    if (message.member.roles.cache.has(MOD_ROLE_ID))     return;

    if (!esSpam(message)) return;

    const count = registrar(message.author.id);

    if (count >= UMBRAL_MENSAJES) {
      _cache.delete(message.author.id);

      const username = message.author.username;
      logger.warn('AntiSpam', `Spam detectado: ${username} (${message.author.id}) en ${message.guild.name}`);

      try {
        await message.guild.members.ban(message.author.id, {
          reason: 'Spam automático detectado por Lumi (links/imágenes masivos)',
          deleteMessageSeconds: 60,
        });

        logger.success('AntiSpam', `${username} baneado en ${message.guild.name}`);
        await notificar(message.guild, message, username);

        if (guildId === readerGuildId && staffGuildId) {
          try {
            const staffGuild = await message.client.guilds.fetch(staffGuildId);
            const recChannelId = process.env.RECORDS_CHANNEL_ID;
            if (recChannelId) {
              const rec = await staffGuild.channels.fetch(recChannelId).catch(() => null);
              if (rec) await rec.send(`🚨 **Anti-spam** — **${username}** baneado automáticamente en el servidor de lectores por spam de links/imágenes.`);
            }
          } catch { /* no crítico */ }
        }

      } catch (err) {
        logger.error('AntiSpam', `No se pudo banear a ${username}: ${err.message}`);
        try {
          await message.member.kick('Spam automático detectado por Lumi');
          await notificar(message.guild, message, username);
        } catch { /* si no puede ni expulsar, al menos loguear */ }
      }
    }
  },
};
