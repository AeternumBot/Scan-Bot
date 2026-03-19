// src/commands/tarea.js
// /tarea — sistema de tareas por capítulo para el staff
// ────────────────────────────────────────────────────────────────────────────

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Tareas, Projects }  = require('../utils/storage');
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

const data = new SlashCommandBuilder()
  .setName('tarea')
  .setDescription('Gestiona las tareas asignadas al staff')
  .addSubcommand(sub =>
    sub.setName('asignar')
      .setDescription('Asigna una tarea a un miembro del staff')
      .addUserOption(o =>
        o.setName('usuario').setDescription('Miembro al que se le asigna la tarea').setRequired(true)
      )
      .addStringOption(o =>
        o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('capitulo').setDescription('Número de capítulo').setRequired(true)
      )
      .addStringOption(o =>
        o.setName('labor').setDescription('Descripción de la labor (ej: traducción, clean, typeo)').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('completar')
      .setDescription('Marca una tarea como completada')
      .addStringOption(o =>
        o.setName('id').setDescription('ID de la tarea (ej: task_1234567890)').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('lista')
      .setDescription('Muestra las tareas activas')
      .addUserOption(o =>
        o.setName('usuario').setDescription('Filtrar por usuario (vacío = todas)')
      )
  )
  .addSubcommand(sub =>
    sub.setName('eliminar')
      .setDescription('Elimina una tarea (solo mods)')
      .addStringOption(o =>
        o.setName('id').setDescription('ID de la tarea').setRequired(true)
      )
  );

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Projects.list()
    .filter(p => p.id.includes(focused) || p.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(p => ({ name: p.id, value: p.id }));
  await interaction.respond(choices);
}

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'asignar')   return handleAsignar(interaction);
  if (sub === 'completar') return handleCompletar(interaction);
  if (sub === 'lista')     return handleLista(interaction);
  if (sub === 'eliminar')  return handleEliminar(interaction);
}

// ── /tarea asignar ────────────────────────────────────────────────────────────

async function handleAsignar(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({
      content: pick([
        `E-eh... solo los moderadores pueden asignar tareas ${K.timida()}`,
        `N-no tengo autorización para hacer eso desde aquí... ${K.tranqui()}`,
      ]),
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const usuario    = interaction.options.getUser('usuario');
  const proyectoId = interaction.options.getString('proyecto');
  const capitulo   = interaction.options.getString('capitulo');
  const labor      = interaction.options.getString('labor');

  const project = Projects.get(proyectoId);
  if (!project) {
    return interaction.editReply(pick([
      `Mmm... no encontré el proyecto \`${proyectoId}\` ${K.timida()} ¿Está bien escrito?`,
      `N-no existe ese proyecto en mis registros ${K.tranqui()}`,
    ]));
  }

  const tarea = Tareas.create({
    projectId:    proyectoId,
    projectName:  project.name,
    capitulo,
    labor,
    asignadoId:   usuario.id,
    asignadoName: usuario.username,
    creadoPor:    interaction.user.id,
  });

  // Notificar en canal de tareas
  const canalId = process.env.TASKS_CHANNEL_ID;
  if (canalId) {
    const canal = await interaction.client.channels.fetch(canalId).catch(() => null);
    if (canal) {
      const mensajes = [
        `📋 ¡Nueva tarea asignada! ${K.feliz()}\n<@${usuario.id}>, te toca la **${labor}** del cap. **${capitulo}** de **${project.name}**.\nID de tarea: \`${tarea.id}\` — Te estaré recordando cada 2 días hasta que la marques como lista ${K.tranqui()}`,
        `📋 Tarea nueva para <@${usuario.id}> ${K.feliz()}\n**Labor:** ${labor}\n**Proyecto:** ${project.name}\n**Capítulo:** ${capitulo}\nID: \`${tarea.id}\` — Recuerda marcarla como completada cuando termines.`,
      ];
      await canal.send(pick(mensajes));
    }
  }

  await interaction.editReply(pick([
    `¡Listo! Le asigné la **${labor}** del cap. **${capitulo}** a **${usuario.username}** ${K.feliz()} ID de tarea: \`${tarea.id}\``,
    `Tarea creada y notificada ${K.feliz()} \`${tarea.id}\` — **${labor}** cap. **${capitulo}** → **${usuario.username}**`,
  ]));
}

// ── /tarea completar ──────────────────────────────────────────────────────────

async function handleCompletar(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const tareaId = interaction.options.getString('id');
  const tarea   = Tareas.get(tareaId);

  if (!tarea) {
    return interaction.editReply(pick([
      `No encontré ninguna tarea con ese ID... ${K.timida()} ¿Está bien escrito?`,
      `Mmm, ese ID no existe en mis registros ${K.tranqui()}`,
    ]));
  }

  // Solo el asignado o un mod puede completarla
  const esAsignado = tarea.asignadoId === interaction.user.id;
  if (!esAsignado && !isMod(interaction.member)) {
    return interaction.editReply(pick([
      `E-eh... solo **${tarea.asignadoName}** o un moderador pueden completar esa tarea ${K.timida()}`,
      `N-no puedo marcar esa tarea como lista desde aquí... no eres el asignado ${K.tranqui()}`,
    ]));
  }

  if (tarea.completada) {
    return interaction.editReply(pick([
      `Esa tarea ya está marcada como completada ${K.feliz()} ¡No hace falta nada más!`,
      `E-eh... ya estaba lista esa tarea desde ${new Date(tarea.completadaAt).toLocaleDateString('es-CO')} ${K.tranqui()}`,
    ]));
  }

  Tareas.completar(tareaId);

  // Notificar en canal de tareas
  const canalId = process.env.TASKS_CHANNEL_ID;
  if (canalId) {
    const canal = await interaction.client.channels.fetch(canalId).catch(() => null);
    if (canal) {
      const mensajes = [
        `✅ ¡Tarea completada! <@${tarea.asignadoId}> terminó la **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}** ${K.feliz()} ¡Bien hecho!`,
        `✅ <@${tarea.asignadoId}> marcó como lista la **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}** ${K.feliz()}`,
        `✅ ¡La **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}** ya está lista! Gracias <@${tarea.asignadoId}> ${K.feliz()}`,
      ];
      await canal.send(pick(mensajes));
    }
  }

  await interaction.editReply(pick([
    `¡Perfecto! Marqué la tarea \`${tareaId}\` como completada ${K.feliz()} ¡Buen trabajo!`,
    `Listo, tarea completada ${K.feliz()} Ya no recibirás más recordatorios por esa.`,
  ]));
}

// ── /tarea lista ──────────────────────────────────────────────────────────────

async function handleLista(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const filtroUsuario = interaction.options.getUser('usuario');
  let tareas = Tareas.listActivas();

  if (filtroUsuario) {
    tareas = tareas.filter(t => t.asignadoId === filtroUsuario.id);
  }

  if (!tareas.length) {
    return interaction.editReply(pick([
      `¡No hay tareas activas${filtroUsuario ? ` para **${filtroUsuario.username}**` : ''}! ${K.feliz()} Todo en orden.`,
      `N-no encontré tareas pendientes${filtroUsuario ? ` de **${filtroUsuario.username}**` : ''} ${K.tranqui()}`,
    ]));
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📋 Tareas activas${filtroUsuario ? ` — ${filtroUsuario.username}` : ''}`)
    .setTimestamp()
    .setFooter({ text: 'Usa /tarea completar <id> para marcarlas como listas (っ˘ω˘ς)' });

  for (const t of tareas.slice(0, 15)) {
    const diasActiva = Math.floor((Date.now() - new Date(t.creadoAt).getTime()) / (24 * 60 * 60 * 1000));
    embed.addFields({
      name: `\`${t.id}\` — ${t.proyectoName} Cap. ${t.capitulo}`,
      value: `**Labor:** ${t.labor}\n**Asignado:** <@${t.asignadoId}>\n**Días activa:** ${diasActiva}`,
      inline: false,
    });
  }

  if (tareas.length > 15) {
    embed.setDescription(`Mostrando 15 de ${tareas.length} tareas activas.`);
  }

  await interaction.editReply({ embeds: [embed] });
}

// ── /tarea eliminar ───────────────────────────────────────────────────────────

async function handleEliminar(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({
      content: `E-eh... solo los moderadores pueden eliminar tareas ${K.timida()}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const tareaId = interaction.options.getString('id');
  const tarea   = Tareas.get(tareaId);

  if (!tarea) {
    return interaction.editReply(`No encontré la tarea \`${tareaId}\` ${K.timida()}`);
  }

  const all = Tareas.getAll();
  delete all[tareaId];
  require('fs-extra').outputJSONSync('./data/tareas.json', all, { spaces: 2 });

  await interaction.editReply(pick([
    `Listo, eliminé la tarea \`${tareaId}\` ${K.tranqui()}`,
    `Tarea \`${tareaId}\` eliminada. Espero que haya sido la decisión correcta ${K.timida()}`,
  ]));
}

module.exports = { data, execute, autocomplete };
