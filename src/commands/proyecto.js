// src/commands/proyecto.js
// /proyecto add | edit | remove | list | info

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const { Projects, LastChapters } = require('../utils/storage');
const SUA = require('../utils/sua');
const { COLORS }    = require('../../config/config');
const tmo           = require('../services/tmoScraper');
const colorcito     = require('../services/colorcito');
const driveService  = require('../services/driveService');

// ── Definición del comando ────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('proyecto')
  .setDescription('Gestiona los proyectos del scan')
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Añade un nuevo proyecto al bot')
      .addStringOption(o => o.setName('nombre').setDescription('Nombre del manga/manhwa').setRequired(true))
      .addStringOption(o => o.setName('drive_folder').setDescription('Nombre exacto de la carpeta en Google Drive').setRequired(true))
      .addStringOption(o =>
        o.setName('categoria').setDescription('Categoría del proyecto').setRequired(true)
          .addChoices(
            { name: 'Manhwas (Coreano)',      value: 'manhwas' },
            { name: 'Mangas (Japones)',       value: 'mangas'  },
            { name: 'Novelas ligeras',        value: 'novelas' },
            { name: 'Joints (Colaboracion)', value: 'joints'  },
          )
      )
      .addStringOption(o => o.setName('tmo_url').setDescription('URL del proyecto en TuMangaOnline (opcional)'))
      .addStringOption(o => o.setName('colorcito_url').setDescription('URL del proyecto en Colorcito (opcional)'))
      .addStringOption(o => o.setName('creditos_default').setDescription('Créditos por defecto del equipo (opcional, ej: "Trad: Ana | Clean: Bob")'))
      .addStringOption(o => o.setName('portada_id').setDescription('ID del mensaje de Discord con la portada (clic derecho al mensaje → Copiar ID)'))
      .addStringOption(o => o.setName('tags').setDescription('Tags separados por coma: romance,accion,color'))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Elimina un proyecto del bot')
      .addStringOption(o => o.setName('id').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true))
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('Lista todos los proyectos configurados')
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Muestra información detallada de un proyecto')
      .addStringOption(o => o.setName('id').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true))
  )
  .addSubcommand(sub =>
    sub.setName('toggle')
      .setDescription('Activa o desactiva el monitoreo de un proyecto')
      .addStringOption(o => o.setName('id').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true))
  )
  .addSubcommand(sub =>
    sub.setName('setstatus')
      .setDescription('Cambia el estado de un proyecto (ongoing, completed, hiatus, dropped)')
      .addStringOption(o => o.setName('id').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true))
      .addStringOption(o =>
        o.setName('estado').setDescription('Estado del proyecto').setRequired(true)
          .addChoices(
            { name: '📖 En curso',    value: 'ongoing'   },
            { name: '✅ Completado',  value: 'completed' },
            { name: '⏸️ Hiatus',     value: 'hiatus'    },
            { name: '❌ Dropeado',   value: 'dropped'   },
          )
      )
  );

// ── Autocomplete ──────────────────────────────────────────────────────────────

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Projects.list()
    .filter(p => p.name.toLowerCase().includes(focused) || p.id.includes(focused))
    .slice(0, 25)
    .map(p => ({ name: `${p.name} (${p.id})`, value: p.id }));
  await interaction.respond(choices);
}

// ── Ejecución ─────────────────────────────────────────────────────────────────

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  // Sólo admins / roles con permisos de gestión de servidor
  if (!interaction.member.permissions.has('ManageGuild')) {
    return interaction.reply({
      content: '❌ Necesitas el permiso **Gestionar Servidor** para usar este comando.',
      ephemeral: true,
    });
  }

  if (sub === 'add')        return handleAdd(interaction);
  if (sub === 'remove')     return handleRemove(interaction);
  if (sub === 'list')       return handleList(interaction);
  if (sub === 'info')       return handleInfo(interaction);
  if (sub === 'toggle')     return handleToggle(interaction);
  if (sub === 'setstatus')  return handleSetStatus(interaction);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const name            = interaction.options.getString('nombre');
  const driveFolder     = interaction.options.getString('drive_folder');
  const categoria       = interaction.options.getString('categoria');
  const tmoUrl          = interaction.options.getString('tmo_url');
  const colIndex        = interaction.options.getString('colorcito_url');
  const creditosDefault = interaction.options.getString('creditos_default') || null;
  const portadaId       = interaction.options.getString('portada_id') || null;

  // Resolver portada desde ID de mensaje de Discord
  let portadaUrl = null;
  if (portadaId) {
    try {
      const covChanId = process.env.COVERS_CHANNEL_ID || interaction.channelId;
      const covChan = await interaction.client.channels.fetch(covChanId).catch(() => null);
      if (covChan) {
        const msg = await covChan.messages.fetch(portadaId).catch(() => null);
        if (msg?.attachments?.size > 0) portadaUrl = msg.attachments.first().url;
        else if (msg?.embeds?.[0]?.image) portadaUrl = msg.embeds[0].image.url;
      }
    } catch { /* no crítico */ }
  }
  const tagsRaw         = interaction.options.getString('tags') || '';

  if (!tmoUrl && !colIndex) {
    return interaction.editReply(SUA.proyecto.sinUrl);
  }

  // Generar ID slug a partir del nombre
  const id = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (Projects.get(id)) {
    return interaction.editReply(SUA.proyecto.yaExiste(id));
  }

  const project = {
    id,
    name,
    category: categoria,
    sources: {
      tmo:       tmoUrl   || null,
      colorcito: colIndex || null,
    },
    driveFolder,
    announcementChannel: null,
    readerRoleId: null,
    roleId:       null,
    reactions:    null,
    defaultCredits: creditosDefault,
    active:    true,
    addedAt:   new Date().toISOString(),
    tags:      tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
    status:    'ongoing',
    thumbnail: portadaUrl || null,
    color:     null,
  };

  // Intentar obtener thumbnail Y guardar capítulo actual como "ya visto"
  // para que el bot no anuncie capítulos que ya existían al añadir el proyecto
  const scrapers = [];
  if (tmoUrl)    scrapers.push({ source: 'tmo',       scraper: tmo,       url: tmoUrl   });
  if (colIndex)  scrapers.push({ source: 'colorcito', scraper: colorcito, url: colIndex });

  for (const { source, scraper, url } of scrapers) {
    try {
      const chapData = await scraper.getLatestChapter(url);
      if (chapData?.thumbnail && !project.thumbnail) {
        project.thumbnail = chapData.thumbnail;
      }
      if (chapData?.chapterNum) {
        // Marcar el capítulo actual como ya visto — NO se anunciará
        LastChapters.set(id, source, {
          chapterNum: chapData.chapterNum,
          chapterUrl: chapData.chapterUrl,
        });
      }
    } catch { /* no crítico */ }
  }

  Projects.save(project);

  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ Proyecto añadido')
    .setDescription(`**${name}** ha sido añadido al bot.`)
    .addFields(
      { name: 'ID',     value: `\`${id}\``,     inline: true },
      { name: 'Drive',  value: driveFolder,      inline: true },
      { name: 'Estado', value: '📖 En curso',    inline: true },
      { name: 'Fuentes',
        value: [
          tmoUrl   ? `• TMO: ${tmoUrl}`           : null,
          colIndex ? `• Colorcito: ${colIndex}`    : null,
        ].filter(Boolean).join('\n'),
      },
      { name: 'Categoría', value: categoria || '—', inline: true },
    )
    .setTimestamp();

  if (project.thumbnail) embed.setThumbnail(project.thumbnail);

  await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction) {
  const id = interaction.options.getString('id');
  const project = Projects.get(id);

  if (!project) {
    return interaction.reply({ content: SUA.proyecto.noEncontrado(id), ephemeral: true });
  }

  // Pedir confirmación
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm_delete_${id}`).setLabel('Sí, eliminar').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cancel_delete').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
  );

  const reply = await interaction.reply({
    content: `⚠️ ¿Seguro que quieres eliminar **${project.name}** (\`${id}\`)?`,
    components: [row],
    ephemeral: true,
    fetchReply: true,
  });

  const collector = reply.createMessageComponentCollector({ time: 15_000 });
  collector.on('collect', async i => {
    if (i.customId === `confirm_delete_${id}`) {
      Projects.delete(id);
      await i.update({ content: SUA.proyecto.eliminado(project.name), components: [] });
    } else {
      await i.update({ content: '❌ Cancelado.', components: [] });
    }
    collector.stop();
  });
}

async function handleList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projects = Projects.list();

  if (!projects.length) {
    return interaction.editReply(SUA.proyecto.sinProyectos);
  }

  const statusIcon = { ongoing: '📖', completed: '✅', hiatus: '⏸️', dropped: '❌' };

  const lines = projects.map(p =>
    `${p.active ? '🟢' : '🔴'} ${statusIcon[p.status] || '❓'} **${p.name}** \`${p.id}\`\n` +
    `   ↳ ${[p.sources.tmo ? 'TMO' : null, p.sources.colorcito ? 'Colorcito' : null].filter(Boolean).join(' + ')} | Drive: ${p.driveFolder}`
  );

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📋 Proyectos configurados (${projects.length})`)
    .setDescription(lines.join('\n\n').slice(0, 4000))
    .setFooter({ text: '🟢 = activo  🔴 = pausado' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleInfo(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const id      = interaction.options.getString('id');
  const project = Projects.get(id);

  if (!project) {
    return interaction.editReply({ content: SUA.proyecto.noEncontrado(id) });
  }

  // Obtener estado de Drive
  const driveStatus = await driveService.getProjectStatus(project.driveFolder);
  const driveLine = driveStatus.found
    ? driveService.buildStatusLine(driveStatus.subfolders)
    : `❓ Carpeta no encontrada: \`${project.driveFolder}\``;

  const statusIcon = { ongoing: '📖 En curso', completed: '✅ Completado', hiatus: '⏸️ Hiatus', dropped: '❌ Dropeado' };

  const embed = new EmbedBuilder()
    .setColor(project.color || COLORS.info)
    .setTitle(`📌 ${project.name}`)
    .addFields(
      { name: 'ID',      value: `\`${project.id}\``,                  inline: true },
      { name: 'Estado',  value: statusIcon[project.status] || '❓',   inline: true },
      { name: 'Activo',  value: project.active ? '✅ Sí' : '❌ No',   inline: true },
      { name: 'Fuentes',
        value: [
          project.sources.tmo       ? `📖 [TMO](${project.sources.tmo})`           : null,
          project.sources.colorcito ? `🎨 [Colorcito](${project.sources.colorcito})`: null,
        ].filter(Boolean).join('\n') || 'Ninguna',
        inline: false,
      },
      { name: '📂 Google Drive', value: driveLine, inline: false },
      { name: 'Rol de ping', value: project.roleId ? `<@&${project.roleId}>` : 'Ninguno', inline: true },
      { name: 'Tags', value: project.tags?.join(', ') || '—', inline: true },
    )
    .setTimestamp();

  if (project.thumbnail) embed.setThumbnail(project.thumbnail);
  if (driveStatus.found) embed.setURL(driveStatus.folderUrl);

  await interaction.editReply({ embeds: [embed] });
}

async function handleToggle(interaction) {
  const id      = interaction.options.getString('id');
  const project = Projects.get(id);

  if (!project) {
    return interaction.reply({ content: SUA.proyecto.noEncontrado(id), ephemeral: true });
  }

  project.active = !project.active;
  Projects.save(project);

  await interaction.reply({
    content: `${project.active ? '✅ Activado' : '⏸️ Pausado'}: **${project.name}**`,
    ephemeral: true,
  });
}

async function handleSetStatus(interaction) {
  const id      = interaction.options.getString('id');
  const estado  = interaction.options.getString('estado');
  const project = Projects.get(id);

  if (!project) {
    return interaction.reply({ content: SUA.proyecto.noEncontrado(id), ephemeral: true });
  }

  project.status = estado;
  Projects.save(project);

  const labels = { ongoing: '📖 En curso', completed: '✅ Completado', hiatus: '⏸️ Hiatus', dropped: '❌ Dropeado' };
  await interaction.reply({
    content: `Estado de **${project.name}** actualizado a: ${labels[estado]}`,
    ephemeral: true,
  });
}

module.exports = { data, execute, autocomplete };
