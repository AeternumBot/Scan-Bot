// src/commands/sincronizar.js
// Fuerza actualización del caché de capítulos en segundo plano

const { SlashCommandBuilder } = require('discord.js');
const { Projects, LastChapters } = require('../utils/storage');
const colorcito = require('../services/colorcito');
const { K } = require('../utils/lumi');

const data = new SlashCommandBuilder()
  .setName('sincronizar')
  .setDescription('Actualiza el caché de capítulos consultando Colorcito')
  .addStringOption(o =>
    o.setName('proyecto')
      .setDescription('Proyecto específico (vacío = todos)')
      .setAutocomplete(true)
  );

async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = Projects.list()
      .filter(p => p.id.includes(focused) || p.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(p => ({ name: p.id, value: p.id }));
    await interaction.respond(choices);
  } catch { }
}

async function execute(interaction) {
  if (interaction.replied || interaction.deferred) return;
  await interaction.deferReply({ ephemeral: true });

  const MOD_ROLE = process.env.MOD_ROLE_ID || '1368818622750789633';
  const hasRole  = interaction.member.roles.cache.has(MOD_ROLE)
    || interaction.member.permissions.has('ManageGuild');
  if (!hasRole) {
    return interaction.editReply({ content: `No tienes permiso para usar este comando ${K.altiva()}` });
  }

  const projectId = interaction.options.getString('proyecto');
  const projects  = projectId
    ? [Projects.get(projectId)].filter(Boolean)
    : Projects.list().filter(p => p.active);

  if (!projects.length) {
    return interaction.editReply({ content: `No encontré ese proyecto ${K.hartazgo()}` });
  }

  await interaction.editReply({
    content: `Sincronizando ${projects.length} proyecto(s) en segundo plano ${K.tranqui()} Te aviso cuando termine.`
  });

  // Ejecutar en background sin bloquear
  (async () => {
    let actualizados = 0;

    for (const project of projects) {
      const url = project.sources?.colorcito;
      if (!url) continue;
      try {
        const data = await colorcito.getLatestChapter(url);
        if (!data?.chapterNum) continue;

        const cached = LastChapters.get(project.id, 'colorcito');
        const liveN  = parseFloat(String(data.chapterNum).replace(',', '.'));
        const cachedN = cached ? parseFloat(String(cached.chapterNum).replace(',', '.')) : -1;

        if (liveN > cachedN) {
          LastChapters.set(project.id, 'colorcito', {
            chapterNum: data.chapterNum,
            chapterUrl: data.chapterUrl,
          });
          actualizados++;
        }
      } catch { }
      await new Promise(r => setTimeout(r, 1500));
    }

    try {
      await interaction.followUp({
        content: `Sincronización completa ${K.social()} ${projects.length} proyecto(s) revisado(s). ${actualizados > 0 ? `Se actualizaron **${actualizados}** capítulo(s).` : 'Todo ya estaba al día.'}`,
        ephemeral: true,
      });
    } catch { }
  })();
}

module.exports = { data, execute, autocomplete };
