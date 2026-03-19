// src/commands/ticket.js
// /ticket — sistema de reporte de errores desde el servidor de lectores
// Los lectores abren tickets, se crea un canal temporal en el servidor de staff
// ────────────────────────────────────────────────────────────────────────────

const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { Tickets, Projects } = require('../utils/storage');
const { COLORS }            = require('../../config/config');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  feliz:   () => pick(['(◕‿◕✿)', '(ﾉ◕ヮ◕)ﾉ', '(*´▽`*)']),
  timida:  () => pick(['(〃>_<;〃)', '(/ω＼)', '(〃ω〃)']),
  triste:  () => pick(['(;ω;)', '(´；ω；`)', '(╥_╥)']),
  tranqui: () => pick(['(˘ω˘)', '(っ˘ω˘ς)', '(￣▽￣)']),
};

const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1368818622750789633';

function isMod(member) {
  return member.roles.cache.has(MOD_ROLE_ID)
    || member.permissions.has('ManageGuild')
    || member.permissions.has('BanMembers');
}

const TIPOS_ERROR = {
  mal_subido: 'Mal subido (páginas faltantes o duplicadas)',
  desorden:   'Desorden de páginas',
  no_carga:   'No carga / Error 404',
  otro:       'Otro',
};

const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Reporta un error en un capítulo')
  .addSubcommand(sub =>
    sub.setName('abrir')
      .setDescription('Abre un ticket de error')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('Proyecto con el error').setRequired(true).setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('capitulo').setDescription('Número de capítulo').setRequired(true)
      )
      .addStringOption(o =>
        o.setName('error').setDescription('Tipo de error').setRequired(true)
          .addChoices(
            { name: 'Mal subido (páginas faltantes o duplicadas)', value: 'mal_subido' },
            { name: 'Desorden de páginas',                         value: 'desorden'   },
            { name: 'No carga / Error 404',                        value: 'no_carga'   },
            { name: 'Otro',                                        value: 'otro'       },
          )
      )
      .addStringOption(o =>
        o.setName('plataforma').setDescription('¿En qué plataforma?').setRequired(true)
          .addChoices(
            { name: 'TMO',       value: 'tmo'       },
            { name: 'Colorcito', value: 'colorcito' },
            { name: 'Ambas',     value: 'ambas'     },
          )
      )
      .addStringOption(o =>
        o.setName('descripcion').setDescription('Descripción adicional del error (opcional)').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('cerrar')
      .setDescription('Cierra un ticket de error (solo mods)')
      .addStringOption(o =>
        o.setName('id').setDescription('ID del ticket (ej: ticket_001)').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('lista')
      .setDescription('Lista los tickets abiertos (solo mods)')
  );

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Projects.list()
    .filter(p => p.id.includes(focused) || p.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(p => ({ name: p.name, value: p.id }));
  await interaction.respond(choices);
}

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'abrir')  return handleAbrir(interaction);
  if (sub === 'cerrar') return handleCerrar(interaction);
  if (sub === 'lista')  return handleLista(interaction);
}

// ── /ticket abrir ─────────────────────────────────────────────────────────────

async function handleAbrir(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const proyectoId  = interaction.options.getString('proyecto');
  const capitulo    = interaction.options.getString('capitulo');
  const tipoError   = interaction.options.getString('error');
  const plataforma  = interaction.options.getString('plataforma');
  const descripcion = interaction.options.getString('descripcion') || '';

  const project = Projects.get(proyectoId);
  if (!project) {
    return interaction.editReply(pick([
      `Mmm... no encontré ese proyecto ${K.timida()} ¿Está bien escrito?`,
      `N-no existe ese proyecto en mis registros ${K.tranqui()}`,
    ]));
  }

  // Verificar que el usuario no tenga ya un ticket abierto para este cap
  const yaAbierto = Tickets.list().find(
    t => t.usuarioId === interaction.user.id
      && t.proyectoId === proyectoId
      && t.capitulo === capitulo
      && t.estado === 'abierto'
  );
  if (yaAbierto) {
    return interaction.editReply(pick([
      `Ya tienes un ticket abierto para el cap. **${capitulo}** de **${project.name}** ${K.timida()} ID: \`${yaAbierto.id}\``,
      `E-eh... ya reportaste ese error. ID del ticket existente: \`${yaAbierto.id}\` ${K.tranqui()}`,
    ]));
  }

  // Crear canal temporal en el servidor de staff
  const staffGuildId = process.env.DISCORD_GUILD_ID;
  if (!staffGuildId) {
    return interaction.editReply(`E-eh... no encontré el servidor de staff configurado ${K.triste()}`);
  }

  let staffGuild;
  try {
    staffGuild = await interaction.client.guilds.fetch(staffGuildId);
  } catch {
    return interaction.editReply(`No pude acceder al servidor de staff ${K.triste()}`);
  }

  // Crear ticket en storage (para obtener el número antes de crear el canal)
  const ticket = Tickets.create({
    usuarioId:    interaction.user.id,
    usuarioName:  interaction.user.username,
    proyectoId,
    proyectoName: project.name,
    capitulo,
    tipoError,
    plataforma,
    descripcion,
    channelId:    'pending',
  });

  if (!ticket) {
    return interaction.editReply(`A-ay... algo salió mal al crear el ticket ${K.triste()} Intenta de nuevo.`);
  }

  // Crear canal temporal
  let canal;
  try {
    canal = await staffGuild.channels.create({
      name:   `ticket-${String(ticket.numero).padStart(3, '0')}-${project.name.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`,
      type:   ChannelType.GuildText,
      topic:  `Ticket ${ticket.id} — ${project.name} Cap. ${capitulo} — ${interaction.user.username}`,
      permissionOverwrites: [
        {
          id:   staffGuild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id:    MOD_ROLE_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id:    staffGuild.members.me.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ],
    });
  } catch (err) {
    // Si falla la creación del canal, eliminar el ticket
    const all = Tickets.getAll();
    delete all.items[ticket.id];
    require('fs-extra').outputJSONSync('./data/tickets.json', all, { spaces: 2 });
    return interaction.editReply(`N-no pude crear el canal del ticket... ${K.triste()} Error: ${err.message}`);
  }

  // Actualizar channelId en el ticket
  ticket.channelId = canal.id;
  Tickets.save(ticket);

  // Enviar resumen en el canal del ticket
  const platLabel = { tmo: 'TMO', colorcito: 'Colorcito', ambas: 'TMO y Colorcito' };
  const embed = new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(`🎫 ${ticket.id} — ${project.name}`)
    .addFields(
      { name: '📖 Proyecto',    value: project.name,                inline: true },
      { name: '📄 Capítulo',    value: `Cap. ${capitulo}`,          inline: true },
      { name: '⚠️ Tipo error',  value: TIPOS_ERROR[tipoError],      inline: true },
      { name: '🔗 Plataforma',  value: platLabel[plataforma],       inline: true },
      { name: '👤 Reportado por', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();

  if (descripcion) {
    embed.addFields({ name: '📝 Descripción', value: descripcion, inline: false });
  }

  const MOD_ROLE = staffGuild.roles.cache.get(MOD_ROLE_ID);
  await canal.send({
    content: pick([
      `<@&${MOD_ROLE_ID}> — Nuevo ticket de error. Por favor revisen ${K.timida()}`,
      `<@&${MOD_ROLE_ID}> — Un lector reportó un error. ${K.tranqui()} Den un vistazo cuando puedan.`,
      `<@&${MOD_ROLE_ID}> — ¡Alerta de error! ${K.triste()} Un lector necesita ayuda.`,
    ]),
    embeds: [embed],
    allowedMentions: { roles: [MOD_ROLE_ID] },
  });

  // También notificar en canal de registros
  const canalRegistros = process.env.RECORDS_CHANNEL_ID;
  if (canalRegistros) {
    const reg = await interaction.client.channels.fetch(canalRegistros).catch(() => null);
    if (reg) {
      await reg.send(
        `🎫 Nuevo ticket \`${ticket.id}\` — **${project.name}** Cap. ${capitulo} | ${TIPOS_ERROR[tipoError]} | ${platLabel[plataforma]}\nCanal: ${canal}`
      );
    }
  }

  await interaction.editReply(pick([
    `¡Tu reporte fue enviado! ${K.feliz()} Ticket: \`${ticket.id}\` — El equipo ya fue notificado y alguien se comunicará contigo pronto.`,
    `Reporte enviado ${K.tranqui()} ID: \`${ticket.id}\` — El staff ya está al tanto. ¡Gracias por ayudarnos a mejorar!`,
    `¡Gracias por reportarlo! ${K.feliz()} \`${ticket.id}\` — Ya le avisé al equipo. En breve alguien te contactará.`,
  ]));
}

// ── /ticket cerrar ────────────────────────────────────────────────────────────

async function handleCerrar(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({
      content: `E-eh... solo los moderadores pueden cerrar tickets ${K.timida()}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketId = interaction.options.getString('id');
  const ticket   = Tickets.get(ticketId);

  if (!ticket) {
    return interaction.editReply(`No encontré el ticket \`${ticketId}\` ${K.timida()}`);
  }
  if (ticket.estado === 'cerrado') {
    return interaction.editReply(`Ese ticket ya está cerrado ${K.tranqui()}`);
  }

  Tickets.cerrar(ticketId, interaction.user.id);

  // Enviar DM al usuario que reportó
  try {
    const usuario = await interaction.client.users.fetch(ticket.usuarioId);
    if (usuario) {
      await usuario.send(pick([
        `¡Hola! ${K.feliz()} Te escribo de parte del equipo de Aeternum Translations. El error que reportaste en el cap. **${ticket.capitulo}** de **${ticket.proyectoName}** (\`${ticketId}\`) ya fue solucionado. ¡Gracias por avisarnos!`,
        `¡Buenas! ${K.tranqui()} El error del cap. **${ticket.capitulo}** de **${ticket.proyectoName}** que reportaste ya fue corregido. Muchas gracias por tu reporte, ¡nos ayuda muchísimo!`,
        `¡Hola! Soy Sua, la asistente de Aeternum Translations ${K.feliz()} El problema que reportaste en **${ticket.proyectoName}** cap. **${ticket.capitulo}** ya quedó resuelto. ¡Gracias por tomarte el tiempo de avisarnos!`,
      ])).catch(() => {/* DMs cerrados */});
    }
  } catch { /* usuario no encontrado */ }

  // Eliminar canal temporal después de 10 segundos
  const staffGuildId = process.env.DISCORD_GUILD_ID;
  if (ticket.channelId && staffGuildId) {
    try {
      const staffGuild = await interaction.client.guilds.fetch(staffGuildId);
      const canal = await staffGuild.channels.fetch(ticket.channelId).catch(() => null);
      if (canal) {
        await canal.send(pick([
          `✅ Ticket cerrado por <@${interaction.user.id}>. Este canal se eliminará en 10 segundos ${K.tranqui()}`,
          `✅ Listo, ticket resuelto. Canal cerrando en 10 segundos... ${K.feliz()}`,
        ]));
        setTimeout(() => canal.delete('Ticket cerrado').catch(() => {}), 10_000);
      }
    } catch { /* canal ya no existe */ }
  }

  await interaction.editReply(pick([
    `¡Ticket \`${ticketId}\` cerrado! ${K.feliz()} Le envié un DM al usuario notificándole que el error fue solucionado.`,
    `Cerrado ${K.tranqui()} \`${ticketId}\` — El usuario ya fue notificado y el canal se eliminará en breve.`,
  ]));
}

// ── /ticket lista ─────────────────────────────────────────────────────────────

async function handleLista(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({
      content: `E-eh... solo los moderadores pueden ver la lista de tickets ${K.timida()}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const tickets = Tickets.listAbiertos();

  if (!tickets.length) {
    return interaction.editReply(pick([
      `¡No hay tickets abiertos! ${K.feliz()} Todo en orden.`,
      `Sin tickets pendientes ${K.tranqui()} El equipo está al día.`,
    ]));
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(`🎫 Tickets abiertos (${tickets.length})`)
    .setTimestamp()
    .setFooter({ text: 'Usa /ticket cerrar <id> cuando esté resuelto (っ˘ω˘ς)' });

  for (const t of tickets.slice(0, 10)) {
    embed.addFields({
      name: `\`${t.id}\` — ${t.proyectoName} Cap. ${t.capitulo}`,
      value: `**Error:** ${TIPOS_ERROR[t.tipoError]}\n**Plataforma:** ${t.plataforma}\n**Reportado por:** ${t.usuarioName}\n**Canal:** <#${t.channelId}>`,
      inline: false,
    });
  }

  if (tickets.length > 10) {
    embed.setDescription(`Mostrando 10 de ${tickets.length} tickets abiertos.`);
  }

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute, autocomplete };
