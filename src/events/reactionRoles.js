// src/events/reactionRoles.js
// Escucha reacciones en el mensaje de roles y asigna/quita roles

const fs = require('fs-extra');
const logger = require('../utils/logger');

const ROLES_FILE = './data/reaction_roles.json';

function loadRolesData() {
  try {
    if (fs.existsSync(ROLES_FILE)) return fs.readJsonSync(ROLES_FILE);
  } catch { }
  return { messageId: null, roles: [] };
}

// Normaliza emoji para comparar (custom: <:name:id> o <a:name:id>, unicode: 🔥)
function normalizeEmoji(emoji) {
  if (emoji.id) return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
  return emoji.name;
}

async function handleReaction(reaction, user, add) {
  if (user.bot) return;

  // Asegurarse de tener la reacción completa
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const rolesData = loadRolesData();
  if (!rolesData.messageId || reaction.message.id !== rolesData.messageId) return;

  const emojiStr = normalizeEmoji(reaction.emoji);

  // Buscar en roles de series + rol de todas las series
  let entry = rolesData.roles.find(r => r.emoji === emojiStr);
  if (!entry && rolesData.emojiTodas === emojiStr) {
    entry = { roleId: '1480960597679149237', projectName: 'Todas las series' };
  }
  if (!entry) return;

  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (!readerGuildId) return;

  try {
    const guild = await reaction.client.guilds.fetch(readerGuildId);
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = await guild.roles.fetch(entry.roleId).catch(() => null);
    if (!role) return;

    if (add) {
      await member.roles.add(role);
      logger.info('ReactionRoles', `+rol "${role.name}" → ${user.tag}`);
    } else {
      await member.roles.remove(role);
      logger.info('ReactionRoles', `-rol "${role.name}" → ${user.tag}`);
    }
  } catch (err) {
    logger.error('ReactionRoles', `Error al ${add ? 'dar' : 'quitar'} rol: ${err.message}`);
  }
}

module.exports = {
  name_add: 'messageReactionAdd',
  name_remove: 'messageReactionRemove',
  handleReaction,
};
