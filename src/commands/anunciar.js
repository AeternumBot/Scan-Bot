// src/commands/anunciar.js
const { SlashCommandBuilder } = require('discord.js');
const { Projects }  = require('../utils/storage');
const logger        = require('../utils/logger');
const LUMI          = require('../utils/lumi');
const { COLORS, SOURCES } = require('../../config/config');
const announcer     = require('../services/announcer');
const colorcito     = require('../services/colorcito');

const data = new SlashCommandBuilder()
  .setName('anunciar')
  .setDescription('Publica manualmente el anuncio de un capítulo')
  .addStringOption(o =>
    o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
  )
  .addStringOption(o =>
    o.setName('capitulo').setDescription('Número de capítulo').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('mensaje').setDescription('Mensaje personalizado (opcional)')
  )
  .addStringOption(o =>
    o.setName('portada_url').setDescription('URL directa de la imagen de portada')
  )
  .addStringOption(o => o.setName('traductores').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('cleaners').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('typeos').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('otros').setDescription('IDs separados por coma'))
  .addRoleOption(o =>
    o.setName('rol_extra').setDescription('Rol adicional a mencionar (opcional)')
  );

// ── Autocomplete: solo IDs ────────────────────────────────────────────────────
async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = Projects.list()
      .filter(p => p.id.includes(focused) || p.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(p => ({ name: p.id, value: p.id }));
    await interaction.respond(choices);
  } catch { /* interacción expirada */ }
}

// ── Execute ───────────────────────────────────────────────────────────────────
async function execute(interaction) {
  if (interaction.replied || interaction.deferred) return;

  const ALLOWED_ROLE = process.env.ANNOUNCER_ROLE_ID;
  const MOD_ROLE     = process.env.MOD_ROLE_ID || '1368818622750789633';
  const rolesPermitidos = [ALLOWED_ROLE, MOD_ROLE].filter(Boolean);
  const hasRole = rolesPermitidos.some(r => interaction.member.roles.cache.has(r))
    || interaction.member.permissions.has('ManageGuild');

  if (!hasRole) {
    return interaction.reply({ content: LUMI.sinPermisos, flags: 64 });
  }

  await interaction.deferReply({ ephemeral: true });

  const projectId      = interaction.options.getString('proyecto');
  const capNum         = interaction.options.getString('capitulo');
  const mensaje        = interaction.options.getString('mensaje');
  const portadaUrl     = interaction.options.getString('portada_url');
  const traductoresRaw = interaction.options.getString('traductores');
  const cleanersRaw    = interaction.options.getString('cleaners');
  const typeosRaw      = interaction.options.getString('typeos');
  const otrosRaw       = interaction.options.getString('otros');
  const rolMencion     = interaction.options.getRole('rol_extra');

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.editReply({ content: LUMI.proyecto.noEncontrado(projectId) });
  }

  // ── Obtener URL de capítulo en Colorcito ──────────────────────────────────
  let chapterUrlColor = null;
  let isEcchi         = false;

  if (project.sources?.colorcito) {
    try {
      const d = await colorcito.getLatestChapter(project.sources.colorcito);
      if (d) {
        chapterUrlColor = d.chapterUrl;
        if (d.isEcchi) isEcchi = true;
        logger.info('Anunciar', `Tags Colorcito: [${(d.tags||[]).join(', ')}] | isEcchi=${d.isEcchi}`);
      }
    } catch { /* no crítico */ }
  }

  const chapData = {
    chapterNum:   capNum,
    chapterTitle: null,
    chapterUrl:   chapterUrlColor || null,
    thumbnail:    portadaUrl || project.thumbnail || null,
    urlColorcito: project.sources?.colorcito || chapterUrlColor || null,
  };

  // ── Créditos ──────────────────────────────────────────────────────────────
  function idsToMentions(raw) {
    if (!raw) return null;
    return raw.split(',')
      .map(id => id.trim())
      .filter(id => /^\d{17,20}$/.test(id))
      .map(id => `<@${id}>`)
      .join(' ');
  }

  const credits = [];
  const mencTraductores = idsToMentions(traductoresRaw);
  const mencCleaners    = idsToMentions(cleanersRaw);
  const mencTypeos      = idsToMentions(typeosRaw);
  const mencOtros       = idsToMentions(otrosRaw);

  if (mencTraductores) credits.push(`📝 **Traducción:** ${mencTraductores}`);
  if (mencCleaners)    credits.push(`🧹 **Clean:** ${mencCleaners}`);
  if (mencTypeos)      credits.push(`✏️ **Typeo/Final:** ${mencTypeos}`);
  if (mencOtros)       credits.push(`🌟 **Otros:** ${mencOtros}`);

  if (!credits.length && project.defaultCredits) {
    credits.push(project.defaultCredits);
  }

  const extraRoles = rolMencion ? [rolMencion.id] : [];

  // ── Nota Ecchi ────────────────────────────────────────────────────────────
  const ECCHI_FRASES = [
    'El contenido habla por sí solo. Lumi no tiene comentarios al respecto (///￣ ￣///)',
    'Lumi entrega esto sin emitir juicio. Aunque le cueste la compostura (>///<)',
    'Hay cosas que Lumi preferiría no saber. Este capítulo es una de ellas (〃////〃)',
    'Lumi tiene estándares. Este capítulo los pone a prueba (///￣ ￣///)',
    'El equipo trabajó en esto. Lumi reconoce el esfuerzo sin hacer preguntas (>///<)',
    'Contenido para adultos. Lumi lo anuncia con la misma dignidad de siempre. Casi (〃////〃)',
    'Lumi no juzga. Lumi simplemente... mira hacia otro lado (///￣ ￣///)',
    '...Lumi vio el tag. Lumi elige ignorar el tag. Aquí está el capítulo (>///<)',
    'Lumi cumple con sus responsabilidades aunque su criterio proteste (〃////〃)',
    'Este capítulo tiene cierto tipo de contenido. Lumi lo deja ahí (///￣ ￣///)',
    'Lumi entrega esto sin comentarios adicionales. Tiene su reputación que cuidar (>///<)',
    'Hay cosas que exceden las expectativas de Lumi. Este capítulo es una de ellas (〃////〃)',
    'Lumi anota mentalmente hablar con el equipo sobre esto. Por ahora, aquí está (///￣ ￣///)',
    'El trabajo es el trabajo. Lumi lo respeta aunque no comparta el enfoque (>///<)',
    'Lumi mantiene la compostura. Le cuesta un poco más esta vez (〃////〃)',
    'Contenido especial. La valoración de Lumi sobre "especial" es otra historia (///￣ ￣///)',
    'Lumi no hace preguntas. Lumi anuncia. Ese es el trato (>///<)',
    'Aquí está el capítulo. Lumi ya habrá olvidado este momento mañana (〃////〃)',
    '...Lumi simplemente va a fingir que este tag no existe y seguir adelante (///￣ ￣///)',
    'El equipo lo pidió, Lumi lo anuncia. La dignidad permanece intacta. Más o menos (>///<)',
    'Lumi reconoce que el esfuerzo de producción fue alto. El contenido es otro asunto (〃////〃)',
    'Algunos capítulos requieren más entereza que otros. Lumi tiene suficiente (///￣ ￣///)',
    'Lumi no tiene objeciones formales. Solo... preferencias personales distintas (>///<)',
    'El anuncio está hecho. Lumi se retira a tomar té y reconsiderar sus decisiones de vida (〃////〃)',
    'Existen límites que Lumi respeta. Anunciar esto está justo en ese límite (///￣ ￣///)',
    'Lumi anota en su bitácora interna: hablar de los criterios editoriales del equipo (>///<)',
    'Se anuncia. Lumi no garantiza que haya leído el capítulo antes (〃////〃)',
    'Lumi mantiene el profesionalismo que la caracteriza. Con esfuerzo visible (///￣ ￣///)',
    'El contenido es lo que es. Lumi es quien es. Coexistencia pacífica (>///<)',
    'Lumi entrega esto con la misma eficiencia de siempre y el doble de incomodidad (〃////〃)',
    'Cada capítulo merece ser anunciado con precisión. Este no es la excepción (///￣ ￣///)',
    'Lumi cumple. El sonrojo es un detalle técnico sin importancia (>///<)',
    'Aquí está. Lumi ya está pensando en otra cosa (〃////〃)',
    'Lumi ha desarrollado la habilidad de anunciar esto sin mirar directamente (///￣ ￣///)',
  ];

  if (!global._ecchiUsadas) global._ecchiUsadas = [];
  const disponibles = ECCHI_FRASES.filter(f => !global._ecchiUsadas.includes(f));
  const pool  = disponibles.length >= 5 ? disponibles : ECCHI_FRASES;
  const frase = pool[Math.floor(Math.random() * pool.length)];
  if (isEcchi) {
    global._ecchiUsadas.push(frase);
    if (global._ecchiUsadas.length > 5) global._ecchiUsadas.shift();
  }

  const ecchiNote  = isEcchi ? ('\n\n*' + frase + '*') : '';
  const mensajeFinal = ((mensaje || '') + ecchiNote).trim() || null;

  // ── Enviar ────────────────────────────────────────────────────────────────
  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    return interaction.editReply({ content: LUMI.anunciar.sinCanal });
  }

  const message = await announcer.sendManualAnnouncement(
    interaction.client,
    project,
    chapData,
    { customMessage: mensajeFinal, imageUrl: portadaUrl, credits, extraRoles }
  );

  if (!message) {
    return interaction.editReply({ content: LUMI.anunciar.errorEnvio });
  }

  await interaction.editReply({ content: LUMI.anunciar.enviado(project.name, capNum) });
}

module.exports = { data, execute, autocomplete };
