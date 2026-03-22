// src/events/antiSpam.js
// Detecta spam de links e imágenes/archivos y banea automáticamente
// Umbral: 5 mensajes con link/imagen en 5 segundos → ban inmediato
// Aplica en ambos servidores (staff y lectores)
// ────────────────────────────────────────────────────────────────────────────

const { Events } = require('discord.js');
const logger = require('../utils/logger');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ── Config ────────────────────────────────────────────────────────────────────
const UMBRAL_MENSAJES = 5;   // mensajes con link/imagen
const VENTANA_MS      = 5000; // en este tiempo (5 segundos)

// ── Caché en memoria: userId → array de timestamps ────────────────────────────
const _cache = new Map();

function registrar(userId) {
  const ahora = Date.now();
  const historial = (_cache.get(userId) || []).filter(t => ahora - t < VENTANA_MS);
  historial.push(ahora);
  _cache.set(userId, historial);
  // Limpiar la entrada después de la ventana para no acumular memoria
  setTimeout(() => {
    const actual = _cache.get(userId) || [];
    if (actual.length === 0) _cache.delete(userId);
  }, VENTANA_MS + 500);
  return historial.length;
}

// ── Detectar si el mensaje tiene link o imagen/archivo ────────────────────────
function esSpam(message) {
  // Imágenes y archivos adjuntos
  if (message.attachments.size > 0) return true;
  // Links / URLs
  if (/https?:\/\/\S+/i.test(message.content)) return true;
  // Embeds (Discord los genera automáticamente para links)
  if (message.embeds.length > 0) return true;
  return false;
}

// ── Frases de Sua al banear ───────────────────────────────────────────────────
const FRASES_SPAM = [
  `¡K-kyaa! ¡Alguien me inundó de mensajes! Ya lo baní... me asustaron mucho (〃>_<;〃)`,
  `¡E-eh! ¡Spam detectado! Ya lo saqué del servidor... qué susto me dieron (；￣ω￣)`,
  `¡A-ay! ¡Alguien estaba haciendo spam! Lo baní antes de que pudiera hacer más daño (╥_╥) ¡Qué nervios!`,
  `¡Ya se fue el spam! Sua al rescate aunque le temblaron los cables (〃>_<;〃)`,
  `D-detecté spam masivo y actué rápido... aunque me asusté bastante (；￣ω￣) Ya está baneado.`,
  `¡Me inundaron de links y me entró el pánico! Ya lo baní (╥_╥) Por favor que no vuelva a pasar...`,
  `Spam detectado y eliminado (〃>_<;〃) N-no me gustan estos momentos... pero alguien tiene que hacerlo.`,
];

// ── Intentar enviar notificación en el canal de logs o el canal actual ─────────
async function notificar(guild, message, username) {
  const frase = pick(FRASES_SPAM);
  const logChannelId = process.env.LOG_CHANNEL_ID || process.env.RECORDS_CHANNEL_ID;

  // Intentar en canal de logs primero
  if (logChannelId) {
    try {
      const canal = await guild.channels.fetch(logChannelId).catch(() => null);
      if (canal?.isTextBased()) {
        await canal.send(`🚨 **Anti-spam** — **${username}** fue baneado automáticamente.\n${frase}`);
        return;
      }
    } catch { /* intentar en el canal del mensaje */ }
  }

  // Fallback: canal donde ocurrió el spam
  try {
    await message.channel.send(frase);
  } catch { /* si el canal ya fue bloqueado, no importa */ }
}

// ── Handler principal ─────────────────────────────────────────────────────────
module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    // Ignorar bots, DMs y mensajes sin servidor
    if (message.author.bot) return;
    if (!message.guild)     return;
    if (!message.member)    return;

    // Solo en los servidores configurados
    const staffGuildId  = process.env.DISCORD_GUILD_ID;
    const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
    const guildId = message.guild.id;
    if (guildId !== staffGuildId && guildId !== readerGuildId) return;

    // Ignorar administradores y mods para no banearse a sí mismo o al equipo
    const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1368818622750789633';
    if (message.member.permissions.has('Administrator')) return;
    if (message.member.permissions.has('ManageGuild'))   return;
    if (message.member.roles.cache.has(MOD_ROLE_ID))     return;

    // Solo contar mensajes con link o imagen
    if (!esSpam(message)) return;

    const count = registrar(message.author.id);

    if (count >= UMBRAL_MENSAJES) {
      // Limpiar caché inmediatamente para no disparar múltiples bans
      _cache.delete(message.author.id);

      const username = message.author.username;
      logger.warn('AntiSpam', `Spam detectado: ${username} (${message.author.id}) en ${message.guild.name}`);

      try {
        await message.guild.members.ban(message.author.id, {
          reason: 'Spam automático detectado por Sua (links/imágenes masivos)',
          deleteMessageSeconds: 60, // borra los últimos 60 segundos de mensajes del usuario
        });

        logger.success('AntiSpam', `${username} baneado en ${message.guild.name}`);
        await notificar(message.guild, message, username);

        // Log en canal de registros del staff también si el ban fue en lectores
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
        // Intentar al menos expulsar si el ban falla
        try {
          await message.member.kick('Spam automático detectado por Sua');
          await notificar(message.guild, message, username);
        } catch { /* si no puede ni expulsar, al menos loguear */ }
      }
    }
  },
};
