// src/commands/avisar.js
// /avisar — publica un aviso oficial de texto libre en el servidor de lectores

const { SlashCommandBuilder } = require('discord.js');
const SUA = require('../utils/sua');

const data = new SlashCommandBuilder()
  .setName('avisar')
  .setDescription('Publica un aviso oficial en el servidor de lectores')
  .addStringOption(o =>
    o.setName('titulo').setDescription('Título del aviso (ej: 📢 Anuncio Oficial)').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('mensaje').setDescription('Cuerpo del mensaje (usa \\n para saltos de línea)').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('ping').setDescription('A quién mencionar')
      .addChoices(
        { name: '@everyone',   value: 'everyone' },
        { name: '@here',       value: 'here'     },
        { name: 'Sin mención', value: 'none'     },
      )
  )
  .addRoleOption(o =>
    o.setName('rol').setDescription('Rol específico a mencionar (opcional)')
  )
  .addStringOption(o =>
    o.setName('firma').setDescription('Firma al pie (por defecto: Líder del equipo de Aeternum Translations)')
  )
  .addStringOption(o =>
    o.setName('imagen').setDescription('URL directa de la imagen a adjuntar (opcional)')
  );

async function execute(interaction) {
  // Roles autorizados: anunciador (lectores) o mod (staff)
  const rolesPermitidos = [
    process.env.ANNOUNCER_ROLE_ID,
    process.env.MOD_ROLE_ID || '1368818622750789633',
  ].filter(Boolean);

  const hasRole = rolesPermitidos.some(r => interaction.member.roles.cache.has(r))
    || interaction.member.permissions.has('ManageGuild');

  if (!hasRole) {
    return interaction.reply({ content: SUA.sinPermisos, ephemeral: true });
  }

  if (interaction.replied || interaction.deferred) return;
  await interaction.deferReply({ ephemeral: true });

  const titulo   = interaction.options.getString('titulo');
  const mensaje  = interaction.options.getString('mensaje').replace(/\\n/g, '\n');
  const pingOpt  = interaction.options.getString('ping') || 'everyone';
  const rol      = interaction.options.getRole('rol') || null;
  const firma    = interaction.options.getString('firma') || 'Líder del equipo de Aeternum Translations.';
  const imagen   = interaction.options.getString('imagen') || null;

  // ── Construir el mensaje ─────────────────────────────────────────────────
  const lines = [];

  // Ping
  if (pingOpt === 'everyone') lines.push('@everyone');
  else if (pingOpt === 'here') lines.push('@here');
  if (rol) lines.push(`<@&${rol.id}>`);

  lines.push('');
  lines.push(`## ${titulo}`);
  lines.push('');
  lines.push(mensaje);
  lines.push('');
  lines.push(`Atentamente,`);
  lines.push(`**${firma}**`);

  const content = lines.join('\n');

  // ── Elegir canal según el servidor donde se ejecuta el comando ───────────
  const STAFF_GUILD_ID   = process.env.DISCORD_GUILD_ID;
  const READER_GUILD_ID  = process.env.DISCORD_READER_GUILD_ID;
  // Lee dinámicamente desde env (puede ser cambiado con /configurar avisos)
  const STAFF_NOTICE_ID  = process.env.STAFF_NOTICE_ID  || '1368814037743177789';
  const READER_NOTICE_ID = process.env.NOTICE_CHANNEL_ID;

  const esStaff  = interaction.guildId === STAFF_GUILD_ID;
  const channelId = esStaff ? STAFF_NOTICE_ID : READER_NOTICE_ID;

  if (!channelId) {
    return interaction.editReply(SUA.avisar.sinCanal);
  }

  let channel = null;
  if (esStaff) {
    channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  } else {
    try {
      const guild = await interaction.client.guilds.fetch(READER_GUILD_ID);
      channel = await guild.channels.fetch(channelId).catch(() => null);
    } catch { }
  }

  if (!channel) {
    return interaction.editReply(SUA.avisar.sinCanal);
  }

  const payload = { content };
  if (imagen) payload.files = [{ attachment: imagen, name: 'imagen.jpg' }];
  await channel.send(payload);
  await interaction.editReply(SUA.avisar.publicado);
}

module.exports = { data, execute };
