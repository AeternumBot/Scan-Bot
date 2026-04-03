// src/services/announcer.js
// Anuncios en texto plano estilo Discord (sin embeds)

const { REACTIONS, SOURCES, ANNOUNCEMENT_FOOTER } = require('../../config/config');
const logger = require('../utils/logger');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

async function getAnnouncementChannel(client, channelId) {
  if (!channelId) return null;
  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (readerGuildId) {
    try {
      const guild = await client.guilds.fetch(readerGuildId);
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      if (ch) return ch;
    } catch { }
  }
  return client.channels.fetch(channelId).catch(() => null);
}

function buildAnnouncementText(project, chapData, options = {}) {
  const { customMessage, credits = [], extraRoles = [] } = options;
  const lines = [];

  // ── Pings ──────────────────────────────────────────────────────────────────
  const pings = ['@everyone'];
  const baseRole = project.readerRoleId || project.roleId;
  if (baseRole) pings.push(`<@&${baseRole}>`);
  extraRoles.forEach(r => pings.push(`<@&${r}>`));
  lines.push(pings.join(' '));

  if (customMessage) {
    lines.push('');
    lines.push(customMessage);
  }

  lines.push('');
  lines.push(`# ${project.name}`);
  lines.push(`Capítulo ${chapData.chapterNum}${chapData.chapterTitle ? `: ${chapData.chapterTitle}` : ''}`);

  const linkLines = [];
  if (project.sources?.tmo && chapData.urlTmo) {
    linkLines.push(`🔗 ${SOURCES.tmo.label}: <${chapData.urlTmo}>`);
  } else if (project.sources?.tmo) {
    linkLines.push(`🔗 ${SOURCES.tmo.label}: <${project.sources.tmo}>`);
  }
  if (project.sources?.colorcito && chapData.urlColorcito) {
    linkLines.push(`🔗 ${SOURCES.colorcito.label}: <${chapData.urlColorcito}>`);
  } else if (project.sources?.colorcito) {
    linkLines.push(`🔗 ${SOURCES.colorcito.label}: <${project.sources.colorcito}>`);
  }

  if (linkLines.length) {
    lines.push('');
    linkLines.forEach(l => lines.push(l));
  }

  const allCredits = [...credits];
  if (!allCredits.length && project.defaultCredits) {
    allCredits.push(project.defaultCredits);
  }
  if (allCredits.length) {
    lines.push('');
    lines.push('🕊️ Staff celestial:');
    allCredits.forEach(c => lines.push(c));
  }

  if (ANNOUNCEMENT_FOOTER?.length) {
    lines.push('');
    lines.push(pick(ANNOUNCEMENT_FOOTER));
  }

  return lines.join('\n');
}

// ── allowedMentions para que @everyone y roles realmente notifiquen ──────────
function buildAllowedMentions(extraRoles = [], baseRole = null) {
  const roles = [];
  if (baseRole) roles.push(baseRole);
  extraRoles.forEach(r => roles.push(r));
  return {
    parse: ['everyone'],
    roles,
  };
}

async function sendAnnouncement(client, project, chapData, source) {
  if (!client?.isReady()) return;

  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    logger.warn('Announcer', `Sin canal de anuncio para ${project.name}`);
    return;
  }

  const channel = await getAnnouncementChannel(client, channelId);
  if (!channel) {
    logger.error('Announcer', `Canal ${channelId} no encontrado`);
    return;
  }

  const chapDataFull = {
    ...chapData,
    urlTmo:       source === 'tmo'       ? chapData.chapterUrl : null,
    urlColorcito: source === 'colorcito' ? chapData.chapterUrl : null,
  };

  const text = buildAnnouncementText(project, chapDataFull);
  const baseRole = project.readerRoleId || project.roleId || null;

  const message = await channel.send({
    content: text,
    allowedMentions: buildAllowedMentions([], baseRole),
  });

  await addReactions(message, project.reactions || REACTIONS.newChapter);
  logger.success('Announcer', `Anuncio enviado: ${project.name} cap. ${chapData.chapterNum}`);
  return message;
}

async function sendManualAnnouncement(client, project, chapData, options = {}) {
  if (!client?.isReady()) return null;

  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) return null;

  const channel = await getAnnouncementChannel(client, channelId);
  if (!channel) return null;

  const text = buildAnnouncementText(project, chapData, options);
  const baseRole = project.readerRoleId || project.roleId || null;

  const messagePayload = {
    content: text,
    allowedMentions: buildAllowedMentions(options.extraRoles || [], baseRole),
  };
  if (options.imageUrl) {
    messagePayload.files = [{ attachment: options.imageUrl, name: 'portada.jpg' }];
  }

  const message = await channel.send(messagePayload);
  await addReactions(message, project.reactions || REACTIONS.newChapter);
  return message;
}

async function addReactions(message, reactions) {
  for (const emoji of reactions) {
    try {
      await message.react(emoji);
      await sleep(400);
    } catch (err) {
      logger.warn('Announcer', `No se pudo reaccionar con ${emoji}: ${err.message}`);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { sendAnnouncement, sendManualAnnouncement, buildAnnouncementText };
