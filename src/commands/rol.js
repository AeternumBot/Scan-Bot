// src/commands/rol.js
// /rol crear  — crea un rol para una serie en el servidor de lectores
// /rol mensaje — publica/actualiza el mensaje de reacción para obtener roles

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Projects } = require('../utils/storage');
const LUMI = require('../utils/lumi');
const fs = require('fs-extra');
const path = require('path');

const ROLES_FILE = './data/reaction_roles.json';
const ROLES_CHANNEL_ID = '1328526832328511488';

// ── Storage para reaction roles ───────────────────────────────────────────────
function loadRolesData() {
  try {
    if (fs.existsSync(ROLES_FILE)) return fs.readJsonSync(ROLES_FILE);
  } catch { }
  return { messageId: null, roles: [] };
  // roles: [{ projectId, projectName, roleId, emoji }]
}

function saveRolesData(data) {
  fs.ensureDirSync('./data');
  fs.writeJsonSync(ROLES_FILE, data, { spaces: 2 });
}

const data = new SlashCommandBuilder()
  .setName('rol')
  .setDescription('Gestión de roles de series')
  .addSubcommand(sub =>
    sub.setName('crear')
      .setDescription('Crea un rol para una serie y lo vincula al proyecto')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('Proyecto al que vincular el rol').setRequired(true).setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('emoji').setDescription('Emoji para el mensaje de roles (ej: 🔥 o ID de emoji custom)').setRequired(true)
      )

  )
  .addSubcommand(sub =>
    sub.setName('mensaje')
      .setDescription('Publica o actualiza el mensaje de reacción para obtener roles de series')
      .addStringOption(o =>
        o.setName('imagen').setDescription('URL de imagen a adjuntar al mensaje (opcional)')
      )
      .addStringOption(o =>
        o.setName('emoji_todas').setDescription('Emoji para el rol "Todas las series" (opcional, se guarda para siempre)')
      )
  )
  .addSubcommand(sub =>
    sub.setName('quitar')
      .setDescription('Quita un rol de series del mensaje de reacción')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('Proyecto a quitar').setRequired(true).setAutocomplete(true)
      )
  );

async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = Projects.list()
      .filter(p => p.name.toLowerCase().includes(focused) || p.id.includes(focused))
      .slice(0, 25)
      .map(p => ({ name: p.name, value: p.id }));
    await interaction.respond(choices);
  } catch { /* ignorar si la interacción ya expiró */ }
}

async function execute(interaction) {
  const ALLOWED_ROLE = process.env.ANNOUNCER_ROLE_ID;
  const hasRole = ALLOWED_ROLE
    ? interaction.member.roles.cache.has(ALLOWED_ROLE)
    : interaction.member.permissions.has('ManageGuild');
  if (!hasRole) {
    return interaction.reply({ content: LUMI.sinPermisos, ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'crear')  return handleCrear(interaction);
  if (sub === 'mensaje') return handleMensaje(interaction);
  if (sub === 'quitar') return handleQuitar(interaction);
}

// ── /rol crear ────────────────────────────────────────────────────────────────
async function handleCrear(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectId = interaction.options.getString('proyecto');
  const emoji     = interaction.options.getString('emoji').trim();


  const project = Projects.get(projectId);
  if (!project) return interaction.editReply(`❌ Proyecto \`${projectId}\` no encontrado.`);

  // Obtener el servidor de lectores
  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (!readerGuildId) return interaction.editReply('❌ DISCORD_READER_GUILD_ID no configurado.');

  const readerGuild = await interaction.client.guilds.fetch(readerGuildId).catch(() => null);
  if (!readerGuild) return interaction.editReply('❌ No se pudo acceder al servidor de lectores.');

  // Verificar si ya existe el rol
  const rolesData = loadRolesData();
  const existing = rolesData.roles.find(r => r.projectId === projectId);
  if (existing) {
    return interaction.editReply(`⚠️ El proyecto **${project.name}** ya tiene un rol vinculado (<@&${existing.roleId}>). Usa \`/rol quitar\` primero si quieres recrearlo.`);
  }

  // Crear el rol en el servidor de lectores
  const roleColor = 0xFFFFFF; // Blanco
  const newRole = await readerGuild.roles.create({
    name: project.name,
    color: roleColor,
    mentionable: true,
    reason: `Rol de serie creado por ${interaction.user.tag}`,
  });

  // Vincular al proyecto
  project.readerRoleId = newRole.id;
  Projects.save(project);

  // Guardar en reaction roles
  rolesData.roles.push({
    projectId,
    projectName: project.name,
    roleId: newRole.id,
    emoji,
  });
  saveRolesData(rolesData);

  await interaction.editReply(
    `✅ Rol **${project.name}** creado en el servidor de lectores.\n` +
    `🎨 Color: Blanco\n` +
    `😀 Emoji: ${emoji}\n` +
    `📌 Vinculado al proyecto \`${projectId}\`\n\n` +
    `Usa \`/rol mensaje\` para actualizar el mensaje de roles.`
  );
}

// ── /rol mensaje ──────────────────────────────────────────────────────────────
async function handleMensaje(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const rolesData = loadRolesData();
  if (!rolesData.roles.length) {
    return interaction.editReply(LUMI.rol.sinRoles);
  }

  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  const readerGuild = await interaction.client.guilds.fetch(readerGuildId).catch(() => null);
  if (!readerGuild) return interaction.editReply('❌ No se pudo acceder al servidor de lectores.');

  const channel = await readerGuild.channels.fetch(ROLES_CHANNEL_ID).catch(() => null);
  if (!channel) return interaction.editReply(`❌ No se encontró el canal de roles (${ROLES_CHANNEL_ID}).`);

  const imagen = interaction.options.getString('imagen') || null;
  const emojiTodas = interaction.options.getString('emoji_todas') || null;
  const TODAS_ROLE_ID = '1480960597679149237';

  // Guardar emoji de "todas las series" si se proporcionó
  if (emojiTodas) {
    rolesData.emojiTodas = emojiTodas;
    saveRolesData(rolesData);
  }
  const anunciosRoleId = TODAS_ROLE_ID;

  // Construir el mensaje
  const lines = [];
  lines.push('@everyone');
  lines.push('');
  lines.push('## 🔔 ¡Elige tu Obra Favorita en Aeternum!');
  lines.push('');
  lines.push('En Aeternum cada lector tiene su obra. Para recibir notificaciones solo de lo que te interesa, activa el sistema de roles por serie.');
  lines.push('');
  lines.push('**📖 ¿Cómo funciona?**');
  lines.push('');
  lines.push('Reacciona con el emoji de la serie que quieres seguir. Es sencillo:');
  lines.push('• Recibirás mención cuando salga un nuevo capítulo');
  lines.push('• No recibirás notificaciones de series que no sigues');
  lines.push('• Puedes cambiar de opinión cuando quieras, solo quita tu reacción');
  lines.push('');
  lines.push('Elige bien.');
  lines.push('');
  for (const r of rolesData.roles) {
    lines.push(`${r.emoji} — **${r.projectName}**`);
  }
  // Entrada de "Todas las series" con su emoji
  if (rolesData.emojiTodas) {
    lines.push(`${rolesData.emojiTodas} — **Todas las series**`);
  }

  lines.push('');
  lines.push(`⏳ Recuerda: Si quieres enterarte de absolutamente todo lo que pasa en el scan (eventos, reclutamiento, noticias generales), asegúrate de tener también el rol de <@&${TODAS_ROLE_ID}>`);
  const content = lines.join('\n');

  let message = null;

  // Si ya existe un mensaje, editarlo
  if (rolesData.messageId) {
    message = await channel.messages.fetch(rolesData.messageId).catch(() => null);
    if (message) {
      await message.edit({ content });
    } else {
      message = null; // ya no existe, crear uno nuevo
    }
  }

  // Crear mensaje nuevo si no había
  if (!message) {
    message = await channel.send({ content });
    rolesData.messageId = message.id;
    saveRolesData(rolesData);
  }

  // Sincronizar reacciones
  // Adjuntar imagen si se proporcionó
  if (imagen) {
    try {
      await message.edit({ content: message.content, files: [{ attachment: imagen, name: 'imagen.jpg' }] });
    } catch { /* no crítico */ }
  }

  // ── Sincronización inteligente de reacciones ─────────────────────────────
  // En vez de borrar todo y volver a reaccionar (lo que hace perder quién reaccionó),
  // comparamos las reacciones actuales con las que deberían estar y solo
  // agregamos las que faltan y quitamos las que sobran.

  const allReactions = [...rolesData.roles];
  if (rolesData.emojiTodas) {
    allReactions.push({ emoji: rolesData.emojiTodas, roleId: TODAS_ROLE_ID, projectName: 'Todas las series', projectId: '__todas__' });
  }

  // Normalizar emoji para comparar (custom: <:name:id> o <a:name:id>, unicode: 🔥)
  function normalizeEmoji(e) {
    if (typeof e === 'string') return e;
    if (e.id) return `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
    return e.name;
  }

  // Emojis que YA están como reacción del bot en el mensaje
  const emojisDeseados = allReactions.map(r => r.emoji);
  const reaccionesActuales = message.reactions.cache;
  const emojisActuales = [];
  reaccionesActuales.forEach(r => {
    if (r.me) emojisActuales.push(normalizeEmoji(r.emoji));
  });

  // Quitar reacciones del bot que ya no deberían estar
  for (const reaction of reaccionesActuales.values()) {
    if (!reaction.me) continue;
    const emojiStr = normalizeEmoji(reaction.emoji);
    if (!emojisDeseados.includes(emojiStr)) {
      await reaction.users.remove(message.client.user.id).catch(() => {});
      await new Promise(res => setTimeout(res, 300));
    }
  }

  // Agregar reacciones que faltan manteniendo el orden
  for (const r of allReactions) {
    if (!emojisActuales.includes(r.emoji)) {
      try {
        await message.react(r.emoji);
        await new Promise(res => setTimeout(res, 500));
      } catch (err) {
        await interaction.followUp({ content: `⚠️ No se pudo reaccionar con ${r.emoji}: ${err.message}`, ephemeral: true });
      }
    }
  }

  await interaction.editReply(LUMI.rol.mensajeActualizado);
}

// ── Exportar constantes para el handler de reacciones ────────────────────────
const TODAS_ROLE_ID = '1480960597679149237';
module.exports.TODAS_ROLE_ID = TODAS_ROLE_ID;

// ── /rol quitar ───────────────────────────────────────────────────────────────
async function handleQuitar(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectId = interaction.options.getString('proyecto');
  const rolesData = loadRolesData();
  const idx = rolesData.roles.findIndex(r => r.projectId === projectId);

  if (idx === -1) return interaction.editReply(LUMI.rol.noVinculado(projectId));

  rolesData.roles.splice(idx, 1);
  saveRolesData(rolesData);

  await interaction.editReply(LUMI.rol.quitado(projectId));
}

module.exports = { data, execute, autocomplete };
