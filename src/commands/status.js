// src/commands/status.js
// /status [proyecto] — estado completo con último capítulo en TMO y Colorcito

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Projects, LastChapters } = require('../utils/storage');
const SUA = require('../utils/sua');
const driveService  = require('../services/driveService');
const { COLORS, CATEGORIES, CHAPTER_FOLDERS } = require('../../config/config');

const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Muestra el estado de traducción de un proyecto')
  .addStringOption(o =>
    o.setName('proyecto')
      .setDescription('Nombre o ID del proyecto (vacío = todos)')
      .setAutocomplete(true)
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
  await interaction.deferReply();
  const projectId = interaction.options.getString('proyecto');

  if (projectId) {
    const project = Projects.get(projectId);
    if (!project) return interaction.editReply({ content: `❌ Proyecto \`${projectId}\` no encontrado.` });
    return sendSingleStatus(interaction, project);
  }
  return sendAllStatus(interaction);
}

async function sendSingleStatus(interaction, project) {
  const ds = await driveService.getProjectStatus(project.driveFolder, project.category);
  const catInfo = CATEGORIES[project.category] || { emoji: '📖', name: '' };

  // Último capítulo en cada plataforma
  const lastTmo   = LastChapters.get(project.id, 'tmo');
  const lastColor = LastChapters.get(project.id, 'colorcito');

  const embed = new EmbedBuilder()
    .setColor(project.color || COLORS.status)
    .setTitle(`${catInfo.emoji} ${project.name} — Estado`)
    .setTimestamp();

  if (project.thumbnail) embed.setThumbnail(project.thumbnail);

  // ── Plataformas ──────────────────────────────────────────────────────────
  const platformLines = [];
  if (project.sources?.tmo) {
    const cap = lastTmo ? `Cap. **${lastTmo.chapterNum}**` : 'Sin datos aún';
    platformLines.push(`📖 **TMO:** ${cap}${lastTmo?.chapterUrl ? ` — [ver](${lastTmo.chapterUrl})` : ''}`);
  }
  if (project.sources?.colorcito) {
    const cap = lastColor ? `Cap. **${lastColor.chapterNum}**` : 'Sin datos aún';
    platformLines.push(`🎨 **Colorcito:** ${cap}${lastColor?.chapterUrl ? ` — [ver](${lastColor.chapterUrl})` : ''}`);
  }

  if (platformLines.length) {
    embed.addFields({ name: '🔗 Último capítulo subido', value: platformLines.join('\n'), inline: false });
  }

  // ── Estado en Drive ──────────────────────────────────────────────────────
  if (!ds.found) {
    embed.addFields({ name: '📂 Google Drive', value: `❓ Carpeta no encontrada: \`${project.driveFolder}\`\n${ds.error || ''}` });
  } else {
    embed.setURL(ds.folderUrl);

    // Resumen general
    const { summary, totalCaps } = ds;
    embed.addFields({
      name: `📂 Drive — ${totalCaps} capítulo(s) en carpeta`,
      value: [
        `\`${buildBar(summary.withClean, totalCaps)}\` 🧹 Cleans: **${summary.withClean}/${totalCaps}**`,
        `\`${buildBar(summary.withTrad,  totalCaps)}\` 📝 Traducciones: **${summary.withTrad}/${totalCaps}**`,
        `\`${buildBar(summary.withFinal, totalCaps)}\` ✏️ Finals/Typeo: **${summary.withFinal}/${totalCaps}**`,
      ].join('\n'),
      inline: false,
    });

    // Último capítulo en Drive con créditos
    if (ds.lastCap) {
      const cap = ds.lastCap;
      const creditLines = driveService.buildCreditsFromDrive(cap);
      const stagesLine  = driveService.buildChapterStatusLine(cap);

      embed.addFields({
        name: `📁 Cap. ${cap.number} (último en Drive)`,
        value: stagesLine + (creditLines.length ? '\n' + creditLines.join(' · ') : ''),
        inline: false,
      });
    }
  }

  // ── Info adicional ───────────────────────────────────────────────────────
  const statusLabels = { ongoing: '📖 En curso', completed: '✅ Completado', hiatus: '⏸️ Hiatus', dropped: '❌ Dropeado' };
  embed.addFields(
    { name: 'Estado',    value: statusLabels[project.status] || '❓', inline: true },
    { name: 'Categoría', value: catInfo.name || '—',                  inline: true },
    { name: 'Activo',    value: project.active ? '✅ Sí' : '🔴 No',  inline: true },
  );

  await interaction.editReply({ embeds: [embed] });
}

async function sendAllStatus(interaction) {
  const projects = Projects.list().filter(p => p.active);
  if (!projects.length) return interaction.editReply(SUA.status.sinActivos);

  await interaction.editReply({ content: SUA.status.consultando(projects.length) });

  const lines = [];
  for (const project of projects) {
    const ds = await driveService.getProjectStatus(project.driveFolder, project.category);
    const lastTmo   = LastChapters.get(project.id, 'tmo');
    const lastColor = LastChapters.get(project.id, 'colorcito');
    const catInfo   = CATEGORIES[project.category] || { emoji: '📖' };

    const lastCap = lastTmo?.chapterNum || lastColor?.chapterNum || '—';

    if (!ds.found) {
      lines.push(`${catInfo.emoji} **${project.name}** — ❓ Drive no encontrado | Último cap: ${lastCap}`);
      continue;
    }

    const { summary, totalCaps } = ds;
    lines.push(
      `${catInfo.emoji} **${project.name}** — ${totalCaps} caps en Drive | Último subido: Cap. **${lastCap}**\n` +
      `   🧹 ${summary.withClean}  📝 ${summary.withTrad}  ✏️ ${summary.withFinal} / ${totalCaps}`
    );
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.status)
    .setTitle('📊 Estado general de proyectos')
    .setDescription(lines.join('\n\n').slice(0, 4000))
    .setTimestamp()
    .setFooter({ text: 'Usa /status <proyecto> para más detalles' });

  await interaction.editReply({ content: null, embeds: [embed] });
}

function buildBar(value, total, size = 8) {
  if (!total) return '░'.repeat(size);
  const filled = Math.round((value / total) * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

module.exports = { data, execute, autocomplete };
