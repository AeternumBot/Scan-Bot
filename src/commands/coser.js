const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const SuaCoser = require('../utils/sua-coser');
const DownloaderHub = require('../utils/downloader');
const { COLORS } = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coser')
        .setDescription('¡Sua usa sus tijeras mágicas para unir y recortar tus raws! (´｡• ᵕ •｡\`)')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Enlace de Mediafire o página de capítulo')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('archivo')
                .setDescription('Archivo ZIP con las imágenes')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('ancho')
                .setDescription('Ancho de salida (Default: 720px)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('altura_max')
                .setDescription('Altura de cada recorte (Default: 10000px)')
                .setRequired(false)),

    async execute(interaction) {
        const url = interaction.options.getString('url');
        const attachment = interaction.options.getAttachment('archivo');
        const enforcedWidth = interaction.options.getInteger('ancho') || 720;
        const splitHeight = interaction.options.getInteger('altura_max') || 10000;

        if (!url && !attachment) {
            return interaction.reply({ content: '(;ω;) ¡A-ay! No me diste nada para coser. Por favor, pásame un link o un archivo.', ephemeral: true });
        }

        await interaction.deferReply();

        const downloader = new DownloaderHub();
        const coser = new SuaCoser({
            enforceWidth: enforcedWidth,
            splitHeight: splitHeight
        });

        const batchId = `coser_${Date.now()}_${interaction.user.id}`;
        const tempFolder = path.join(__dirname, '..', '..', 'temp', batchId);

        try {
            await downloader.init();
            await fs.ensureDir(tempFolder);

            let imagePaths = [];

            // Fase de Descarga
            if (attachment) {
                if (!attachment.name.toLowerCase().endsWith('.zip')) {
                    return interaction.editReply('(´｡• 💧 •｡`) Lo siento, mis tijeras solo saben abrir paquetes .ZIP por ahora.');
                }
                await interaction.editReply('¡Sua ha recibido tu paquete! (o^▽^o) Abriéndolo...');
                imagePaths = await downloader.downloadAndExtractZip(attachment.url, batchId);
            } else if (url) {
                await interaction.editReply('¡Sua está corriendo a buscar tus imágenes! 🏃‍♀️💨');
                if (url.includes('mediafire.com')) {
                    imagePaths = await downloader.downloadFromFileHost(url, batchId);
                } else {
                    // scraping genérico para cualquier página de capítulo
                    imagePaths = await downloader.downloadFromFileHost(url, batchId);
                }
            }

            if (!imagePaths || imagePaths.length === 0) {
                throw new Error('No encontré imágenes válidas. (╥﹏╥)');
            }

            // Ordenar imágenes
            imagePaths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            await interaction.editReply(`¡Tengo ${imagePaths.length} imágenes! (´｡• ᵕ •｡\`) Empezando a coser...`);

            // Fase de Procesamiento (Motor Sua-Coser Ultra-Lite)
            const resultBuffers = await coser.process(imagePaths);

            if (resultBuffers.length === 0) {
                throw new Error('Algo salió mal al usar mis tijeras mágicas... (⌣_⌣”)');
            }

            // Guardar resultados y empaquetar
            const zip = new AdmZip();
            for (let i = 0; i < resultBuffers.length; i++) {
                const fileName = `pagina_${(i + 1).toString().padStart(3, '0')}.jpg`;
                zip.addFile(fileName, resultBuffers[i]);
            }

            const zipPath = path.join(tempFolder, 'resultado_sua_coser.zip');
            zip.writeZip(zipPath);

            const stats = await fs.stat(zipPath);
            const sizeMB = stats.size / (1024 * 1024);

            const embed = new EmbedBuilder()
                .setColor(COLORS.success || '#57F287')
                .setTitle('✨ ¡Sua-Coser ha terminado! ✨')
                .setDescription(`¡He dejado tus raws perfectas! (´｡• ᵕ •｡\`)`)
                .addFields(
                    { name: '📥 Origen', value: url ? 'Enlace Externo' : 'Arvhivo de Discord', inline: true },
                    { name: '🖼️ Resultado', value: `${resultBuffers.length} recortes`, inline: true },
                    { name: '📏 Ajustes', value: `${enforcedWidth}px de ancho`, inline: true }
                )
                .setFooter({ text: 'Hecho con amor por Sua (´｡• ᵕ •｡\`)' })
                .setTimestamp();

            // Límite de 25MB
            if (sizeMB > 24) {
                await interaction.editReply({ 
                    content: `¡A-ay! El paquete pesa **${sizeMB.toFixed(1)}MB**. Es muy pesado para mis brazos, así que lo enviaré en partes...`,
                    embeds: [embed] 
                });

                const splitZips = [];
                let currentZip = new AdmZip();
                let currentSize = 0;
                let partIndex = 1;

                for (let i = 0; i < resultBuffers.length; i++) {
                    const fileName = `pagina_${(i + 1).toString().padStart(3, '0')}.jpg`;
                    const buf = resultBuffers[i];
                    
                    if (currentSize + buf.length > 22 * 1024 * 1024 && i > 0) {
                        const pPath = path.join(tempFolder, `parte_${partIndex}.zip`);
                        currentZip.writeZip(pPath);
                        splitZips.push(new AttachmentBuilder(pPath, { name: `SuaCoser_Parte_${partIndex}.zip` }));
                        currentZip = new AdmZip();
                        currentSize = 0;
                        partIndex++;
                    }
                    currentZip.addFile(fileName, buf);
                    currentSize += buf.length;
                }
                const pPath = path.join(tempFolder, `parte_${partIndex}.zip`);
                currentZip.writeZip(pPath);
                splitZips.push(new AttachmentBuilder(pPath, { name: `SuaCoser_Parte_${partIndex}.zip` }));

                await interaction.followUp({ files: splitZips });
            } else {
                const finalFile = new AttachmentBuilder(zipPath, { name: 'SuaCoser_Final.zip' });
                await interaction.editReply({ embeds: [embed], files: [finalFile] });
            }

        } catch (error) {
            console.error('[Command: Sua-Coser] Error:', error);
            await interaction.editReply(`(;ω;) ¡A-ay! Perdona, me corté un dedo... Error: ${error.message}`);
        } finally {
            try {
                await fs.remove(tempFolder);
            } catch (cleanupErr) {
                console.error('[Sua-Coser] Cleanup Error:', cleanupErr);
            }
        }
    }
};
