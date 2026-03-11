// src/commands/anunciar.js
// /anunciar — anuncio manual con mensaje personalizado, portada, créditos y roles

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Projects }  = require('../utils/storage');
const SUA = require('../utils/sua');
const { COLORS, SOURCES }    = require('../../config/config');
const announcer     = require('../services/announcer');
const tmo           = require('../services/tmoScraper');
const colorcito     = require('../services/colorcito');

const data = new SlashCommandBuilder()
  .setName('anunciar')
  .setDescription('Publica manualmente el anuncio de un capítulo')
  .addStringOption(o =>
    o.setName('proyecto').setDescription('Proyecto a anunciar').setRequired(true).setAutocomplete(true)
  )
  .addStringOption(o =>
    o.setName('capitulo').setDescription('Número de capítulo').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('mensaje').setDescription('Mensaje personalizado para el anuncio (opcional)')
  )
  .addStringOption(o =>
    o.setName('portada_url').setDescription('URL directa de la imagen de portada (clic derecho en la imagen → Copiar enlace)')
  )
  // Créditos por ID de usuario (se convertirán en @mención)
  .addStringOption(o => o.setName('traductores').setDescription('IDs de traductores separados por coma'))
  .addStringOption(o => o.setName('cleaners').setDescription('IDs de cleaners separados por coma'))
  .addStringOption(o => o.setName('typeos').setDescription('IDs de typeadores/finalizadores separados por coma'))
  .addStringOption(o => o.setName('otros_ids').setDescription('IDs de otros colaboradores separados por coma'))
  // Roles extra a mencionar (además del rol fijo del proyecto)
  .addStringOption(o =>
    o.setName('tmo_link').setDescription('Link directo del capítulo en TMO (opcional, sobreescribe el automático)')
  )
  .addRoleOption(o =>
    o.setName('rol').setDescription('Rol a mencionar en el anuncio (opcional, además de @everyone)')
  )
  .addStringOption(o =>
    o.setName('fuente')
      .setDescription('Fuente del capítulo')
      .addChoices(
        { name: '📖 TuMangaOnline', value: 'tmo'       },
        { name: '🎨 Colorcito',     value: 'colorcito'  },
        { name: '🔗 Ambas',         value: 'ambas'      },
      )
  );

async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = Projects.list()
      .filter(p => p.name.toLowerCase().includes(focused) || p.id.includes(focused))
      .slice(0, 25)
      .map(p => ({ name: `${p.name} [${p.id}]`, value: p.id }));
    await interaction.respond(choices);
  } catch { /* interacción expirada */ }
}

async function execute(interaction) {
  const ALLOWED_ROLE = process.env.ANNOUNCER_ROLE_ID;
  const hasRole = ALLOWED_ROLE
    ? interaction.member.roles.cache.has(ALLOWED_ROLE)
    : interaction.member.permissions.has('ManageGuild');
  if (!hasRole) {
    return interaction.reply({ content: SUA.sinPermisos, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const projectId   = interaction.options.getString('proyecto');
  const capNum      = interaction.options.getString('capitulo');
  const mensaje     = interaction.options.getString('mensaje') || null;
  const portadaUrl  = interaction.options.getString('portada_url') || null;
  const traductoresRaw = interaction.options.getString('traductores') || null;
  const cleanersRaw    = interaction.options.getString('cleaners') || null;
  const typeosRaw      = interaction.options.getString('typeos') || null;
  const otrosRaw       = interaction.options.getString('otros_ids') || null;
  const tmoLinkManual = interaction.options.getString('tmo_link') || null;
  const rolMencion  = interaction.options.getRole('rol') || null;
  const fuenteOpt   = interaction.options.getString('fuente') || 'ambas';

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.editReply({ content: SUA.proyecto.noEncontrado(projectId) });
  }

  // ── Construir datos del capítulo ─────────────────────────────────────────
  // Intentar obtener URL real del capítulo desde la fuente
  let chapterUrl = null;
  let chapterUrlTmo = null;
  let chapterUrlColor = null;

  if ((fuenteOpt === 'tmo' || fuenteOpt === 'ambas') && project.sources?.tmo) {
    const d = await tmo.getLatestChapter(project.sources.tmo);
    if (d) chapterUrlTmo = d.chapterUrl;
  }
  if ((fuenteOpt === 'colorcito' || fuenteOpt === 'ambas') && project.sources?.colorcito) {
    const d = await colorcito.getLatestChapter(project.sources.colorcito);
    if (d) chapterUrlColor = d.chapterUrl;
  }

  // portadaUrl ya es la URL directa — no hay nada que resolver

  const chapData = {
    chapterNum: capNum,
    chapterTitle: null,
    chapterUrl: tmoLinkManual || chapterUrlTmo || chapterUrlColor || null,
    thumbnail: portadaUrl || project.thumbnail || null,
    // TMO: usa el link manual si se proporcionó, si no el automático
    urlTmo: tmoLinkManual || chapterUrlTmo || null,
    // Colorcito: siempre usa la URL base del proyecto (sin /capitulo-N)
    urlColorcito: project.sources?.colorcito || chapterUrlColor || null,
  };

  // ── Construir créditos desde IDs de usuario ────────────────────────────
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

  // Si no se especificó nada, usar los créditos por defecto del proyecto
  if (!credits.length && project.defaultCredits) {
    credits.push(project.defaultCredits);
  }

  // ── Rol extra ────────────────────────────────────────────────────────────
  const extraRoles = rolMencion ? [rolMencion.id] : [];

  // ── Enviar anuncio ───────────────────────────────────────────────────────
  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    return interaction.editReply({ content: SUA.anunciar.sinCanal });
  }

  const message = await announcer.sendManualAnnouncement(
    interaction.client,
    project,
    chapData,
    { customMessage: mensaje, imageUrl: portadaUrl, credits, extraRoles }
  );

  if (!message) {
    return interaction.editReply({ content: SUA.anunciar.errorEnvio });
  }

  await interaction.editReply({ content: SUA.anunciar.enviado(project.name, capNum) });
}

module.exports = { data, execute, autocomplete };
