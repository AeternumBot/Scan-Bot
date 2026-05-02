// src/commands/configurar.js
// /configurar — panel de configuración del bot en Discord

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

const { Projects } = require('../utils/storage');
const { COLORS } = require('../../config/config');
const monitor = require('../services/monitor');
const fs   = require('fs-extra');

// ── Config persistente ────────────────────────────────────────────────────────
const BOT_CONFIG_FILE = './data/bot_config.json';

function loadBotConfig() {
  try {
    if (fs.existsSync(BOT_CONFIG_FILE)) return fs.readJsonSync(BOT_CONFIG_FILE);
  } catch { }
  return {};
}

function saveBotConfig(key, value) {
  fs.ensureDirSync('./data');
  const cfg = loadBotConfig();
  cfg[key] = value;
  fs.writeJsonSync(BOT_CONFIG_FILE, cfg, { spaces: 2 });
  process.env[key] = value;
}

function applyBotConfig() {
  const cfg = loadBotConfig();
  for (const [key, value] of Object.entries(cfg)) {
    if (value) process.env[key] = value;
  }
}

const data = new SlashCommandBuilder()
  .setName('configurar')
  .setDescription('Panel de configuración del bot (solo admins)')
  .addSubcommand(sub =>
    sub.setName('canal')
      .setDescription('Cambia el canal de anuncios por defecto o de un proyecto específico')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal donde se publicarán los anuncios')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName('proyecto')
          .setDescription('Proyecto específico (vacío = canal global por defecto)')
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('reacciones')
      .setDescription('Configura las reacciones de un proyecto')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('emojis')
          .setDescription('Emojis separados por espacio, ej: ❤️ 🔥 👏')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('rol')
      .setDescription('Asigna el rol de ping del servidor de LECTORES a un proyecto')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('rol_id').setDescription('ID del rol en el servidor de lectores (clic derecho → Copiar ID)')
      )
  )
  .addSubcommand(sub =>
    sub.setName('verificar')
      .setDescription('Fuerza una verificación de nuevos capítulos ahora mismo')
  )
  .addSubcommand(sub =>
    sub.setName('avisos')
      .setDescription('Cambia el canal donde /avisar publica los avisos')
      .addChannelOption(o =>
        o.setName('canal')
          .setDescription('Canal de avisos')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('estancado')
      .setDescription('Configura días de alerta de capítulos estancados para un proyecto')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
      )
      .addIntegerOption(o =>
        o.setName('dias')
          .setDescription('Días sin actividad antes de alertar (0 = desactivar)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(60)
      )
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Muestra la configuración actual del bot')
  );

// ── Autocomplete ──────────────────────────────────────────────────────────────

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Projects.list()
    .filter(p => p.name.toLowerCase().includes(focused) || p.id.includes(focused))
    .slice(0, 25)
    .map(p => ({ name: p.id, value: p.id }));
  await interaction.respond(choices);
}

// ── Execute ───────────────────────────────────────────────────────────────────

async function execute(interaction) {
  if (!interaction.member.permissions.has('ManageGuild')) {
    return interaction.reply({
      content: '❌ Necesitas el permiso **Gestionar Servidor** para usar `/configurar`.',
      ephemeral: true,
    });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'canal')      return handleCanal(interaction);
  if (sub === 'reacciones') return handleReacciones(interaction);
  if (sub === 'rol')        return handleRol(interaction);
  if (sub === 'verificar')  return handleVerificar(interaction);
  if (sub === 'avisos')     return handleAvisos(interaction);
  if (sub === 'estancado')  return handleEstancado(interaction);
  if (sub === 'info')       return handleInfo(interaction);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCanal(interaction) {
  const canal     = interaction.options.getChannel('canal');
  const projectId = interaction.options.getString('proyecto');

  if (projectId) {
    const project = Projects.get(projectId);
    if (!project) {
      return interaction.reply({ content: `❌ Proyecto \`${projectId}\` no encontrado.`, ephemeral: true });
    }
    project.announcementChannel = canal.id;
    Projects.save(project);
    return interaction.reply({
      content: `✅ Canal de **${project.name}** actualizado a ${canal}.`,
      ephemeral: true,
    });
  }

  saveBotConfig('ANNOUNCEMENT_CHANNEL_ID', canal.id);

  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ Canal de anuncios actualizado')
    .setDescription(`Los anuncios se publicarán en ${canal}. El cambio quedó guardado y persistirá al reiniciar.`)
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleReacciones(interaction) {
  const projectId = interaction.options.getString('proyecto');
  const emojisRaw = interaction.options.getString('emojis');

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.reply({ content: `❌ Proyecto \`${projectId}\` no encontrado.`, ephemeral: true });
  }

  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:\w+:\d+>)/gu;
  const emojis = emojisRaw.match(emojiRegex) || [];

  if (!emojis.length) {
    return interaction.reply({
      content: '❌ No se detectaron emojis válidos. Usa emojis estándar o emojis custom del servidor.',
      ephemeral: true,
    });
  }

  project.reactions = emojis;
  Projects.save(project);

  await interaction.reply({
    content: `✅ Reacciones de **${project.name}** actualizadas: ${emojis.join(' ')}`,
    ephemeral: true,
  });
}

async function handleRol(interaction) {
  const projectId = interaction.options.getString('proyecto');
  const rolId     = interaction.options.getString('rol_id')?.trim() || null;

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.reply({ content: `❌ Proyecto \`${projectId}\` no encontrado.`, ephemeral: true });
  }

  if (rolId && !/^\d{17,20}$/.test(rolId)) {
    return interaction.reply({
      content: '❌ El ID del rol no parece válido. Activa el Modo Desarrollador en Discord, luego clic derecho en el rol del servidor de lectores → **Copiar ID**.',
      ephemeral: true,
    });
  }

  project.readerRoleId = rolId;
  Projects.save(project);

  await interaction.reply({
    content: rolId
      ? `✅ Rol de ping de **${project.name}** actualizado.\n> ID: \`${rolId}\`\n> Se usará este rol al anunciar en el servidor de lectores.`
      : `✅ Rol de ping de **${project.name}** eliminado.`,
    ephemeral: true,
  });
}

async function handleVerificar(interaction) {
  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply('🔄 Iniciando verificación manual...');

  try {
    await monitor.forceCheck(interaction.client);
    await interaction.editReply('✅ Verificación completada. Revisa el canal de registros si hay novedades.');
  } catch (err) {
    await interaction.editReply(`❌ Error durante la verificación: ${err.message}`);
  }
}

async function handleAvisos(interaction) {
  const canal   = interaction.options.getChannel('canal');
  const esStaff = interaction.guildId === process.env.DISCORD_GUILD_ID;
  const envKey  = esStaff ? 'STAFF_NOTICE_ID' : 'NOTICE_CHANNEL_ID';

  saveBotConfig(envKey, canal.id);

  await interaction.reply({
    content: `✅ Canal de avisos actualizado a ${canal}. El cambio quedó guardado y persistirá al reiniciar.`,
    ephemeral: true,
  });
}

async function handleInfo(interaction) {
  const projects = Projects.list();
  const active   = projects.filter(p => p.active).length;

  const fmt = id => id ? `<#${id}>` : '`No configurado`';

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('⚙️ Configuración del bot')
    .addFields(
      { name: '📢 Anuncios',        value: fmt(process.env.ANNOUNCEMENT_CHANNEL_ID), inline: true },
      { name: '📣 Avisos staff',    value: fmt(process.env.STAFF_NOTICE_ID),          inline: true },
      { name: '📣 Avisos lectores', value: fmt(process.env.NOTICE_CHANNEL_ID),        inline: true },
      { name: '📁 Registros',       value: fmt(process.env.RECORDS_CHANNEL_ID),       inline: true },
      { name: '📊 Proyectos',       value: `${projects.length} total · ${active} activos`, inline: true },
      { name: '⏱️ Check interval',  value: `Cada ${process.env.CHECK_INTERVAL_MINUTES || 25} min`, inline: true },
      { name: '🕐 Zona horaria',    value: process.env.TIMEZONE || 'America/Bogota',  inline: true },
      { name: '📦 Node.js',         value: process.version,                           inline: true },
    )
    .addFields({
      name: '🔧 Comandos disponibles',
      value:
        '`/proyecto add/remove/list/info/toggle/setstatus`\n' +
        '`/status [proyecto]`\n' +
        '`/configurar canal/reacciones/rol/avisos/estancado/verificar/info`\n' +
        '`/anunciar` · `/avisar` · `/salud` · `/moderar`',
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleEstancado(interaction) {
  const projectId = interaction.options.getString('proyecto');
  const dias      = interaction.options.getInteger('dias');

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.reply({ content: `❌ Proyecto \`${projectId}\` no encontrado.`, ephemeral: true });
  }

  project.staleAlertDays = dias > 0 ? dias : null;
  Projects.save(project);

  await interaction.reply({
    content: dias > 0
      ? `✅ Alerta de estancado para **${project.name}** configurada a **${dias} días**.`
      : `✅ Alerta de estancado para **${project.name}** desactivada.`,
    ephemeral: true,
  });
}

module.exports = { data, execute, autocomplete, applyBotConfig };
