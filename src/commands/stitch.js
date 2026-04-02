const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const SmartStitcher = require('../utils/stitcher');
const DownloaderHub = require('../utils/downloader');
const { COLORS } = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stitch')
        .setDescription('Une y recorta imágenes de forma inteligente (Estilo Webtoon)')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Enlace de Gofile, Mediafire, Naver o link directo a ZIP/Imágenes')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('archivo')
                .setDescription('Archivo ZIP con las imágenes a procesar')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('ancho')
                .setDescription('Ancho de salida forzado (Por defecto: 720px)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('altura_max')
                .setDescription('Altura máxima de cada recorte (Por defecto: 10000px)')
                .setRequired(false)),

    async execute(interaction) {
        const url = interaction.options.getString('url');
        const attachment = interaction.options.getAttachment('archivo');
        const enforcedWidth = interaction.options.getInteger('ancho') || 720;
        const splitHeight = interaction.options.getInteger('altura_max') || 10000;

        if (!url && !attachment) {
            return interaction.reply({ content: '❌ Debes proporcionar un enlace o subir un archivo ZIP.', ephemeral: true });
        }

        await interaction.deferReply();

        const downloader = new DownloaderHub();
        const stitcher = new SmartStitcher({
            enforceWidth: enforcedWidth,
            splitHeight: splitHeight
        });

        const batchId = `stitch_${Date.now()}_${interaction.user.id}`;
        const tempFolder = path.join(__dirname, '..', '..', 'temp', batchId);
        const outputFolder = path.join(tempFolder, 'output');

        try {
            await downloader.init();
            await fs.ensureDir(tempFolder);
            await fs.ensureDir(outputFolder);

            let imagePaths = [];

            // Fase de Descarga
            if (attachment) {
                if (!attachment.name.toLowerCase().endsWith('.zip')) {
                    return interaction.editReply('❌ El archivo adjunto debe ser un .ZIP');
                }
                await interaction.editReply('⏳ Descargando y extrayendo ZIP...');
                imagePaths = await downloader.downloadAndExtractZip(attachment.url, batchId);
            } else if (url) {
                await interaction.editReply('⏳ Procesando enlace y descargando imágenes...');
                if (url.includes('naver.com')) {
                    imagePaths = await downloader.scrapeFromNaver(url, batchId);
                } else if (url.includes('gofile.io') || url.includes('mediafire.com')) {
                    imagePaths = await downloader.downloadFromFileHost(url, batchId);
                } else {
                    imagePaths = await downloader.downloadFromDiscordAttachments([url], batchId);
                }
            }

            if (!imagePaths || imagePaths.length === 0) {
                throw new Error('No se pudieron obtener imágenes válidas para procesar.');
            }

            // Ordenar imágenes para procesar en orden alfabético
            imagePaths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            await interaction.editReply(`✂️ Procesando ${imagePaths.length} imágenes con SmartStitch...`);

            // Fase de Procesamiento
            const buffers = await Promise.all(imagePaths.map(p => fs.readFile(p)));
            const resultBuffers = await stitcher.process(buffers);

            if (resultBuffers.length === 0) {
                throw new Error('El proceso de recorte no generó ningún resultado.');
            }

            // Guardar resultados y empaquetar
            const zip = new AdmZip();
            for (let i = 0; i < resultBuffers.length; i++) {
                const fileName = `page_${(i + 1).toString().padStart(3, '0')}.jpg`;
                zip.addFile(fileName, resultBuffers[i]);
            }

            const zipPath = path.join(tempFolder, 'resultado_final.zip');
            zip.writeZip(zipPath);

            const stats = await fs.stat(zipPath);
            const sizeMB = stats.size / (1024 * 1024);

            const embed = new EmbedBuilder()
                .setColor(COLORS.success || '#00ff00')
                .setTitle('✅ SmartStitch Completado')
                .setDescription(`Se han unido y recortado las imágenes exitosamente.`)
                .addFields(
                    { name: '📥 Origen', value: url ? (url.length > 50 ? url.substring(0, 47) + '...' : url) : 'Archivo Subido', inline: true },
                    { name: '🖼️ Resultado', value: `${resultBuffers.length} páginas`, inline: true },
                    { name: '📏 Ajustes', value: `Ancho: ${enforcedWidth}px | Corte: ${splitHeight}px`, inline: true }
                )
                .setTimestamp();

            // Manejo del límite de 25MB de Discord
            if (sizeMB > 25) {
                await interaction.editReply({ 
                    content: `⚠️ El archivo pesa **${sizeMB.toFixed(1)}MB** (Límite: 25MB). Dividiendo en partes...`,
                    embeds: [embed] 
                });

                // Lógica de split: creamos varios zips si es necesario
                // Para simplificar esta versión, si pesa mucho avisamos y enviamos lo que podamos o dividimos las imágenes
                const splitZips = [];
                let currentZip = new AdmZip();
                let currentSize = 0;
                let partIndex = 1;

                for (let i = 0; i < resultBuffers.length; i++) {
                    const fileName = `page_${(i + 1).toString().padStart(3, '0')}.jpg`;
                    const buf = resultBuffers[i];
                    
                    if (currentSize + buf.length > 20 * 1024 * 1024 && i > 0) { // Límite conservador de 20MB por parte
                        const pPath = path.join(tempFolder, `resultado_parte_${partIndex}.zip`);
                        currentZip.writeZip(pPath);
                        splitZips.push(new AttachmentBuilder(pPath, { name: `resultado_parte_${partIndex}.zip` }));
                        
                        currentZip = new AdmZip();
                        currentSize = 0;
                        partIndex++;
                    }
                    
                    currentZip.addFile(fileName, buf);
                    currentSize += buf.length;
                }
                
                // Ultima parte
                const pPath = path.join(tempFolder, `resultado_parte_${partIndex}.zip`);
                currentZip.writeZip(pPath);
                splitZips.push(new AttachmentBuilder(pPath, { name: `resultado_parte_${partIndex}.zip` }));

                // Enviar partes (Discord permite hasta 10 archivos por mensaje)
                await interaction.followUp({ files: splitZips });
            } else {
                const finalFile = new AttachmentBuilder(zipPath, { name: 'SmartStitch_Resultado.zip' });
                await interaction.editReply({ embeds: [embed], files: [finalFile] });
            }

        } catch (error) {
            console.error('[Command: Stitch] Error:', error);
            await interaction.editReply(`❌ Error en el proceso: ${error.message}`);
        } finally {
            // Limpieza (Opcional: puedes comentarlo para debuggear)
            try {
                await fs.remove(tempFolder);
            } catch (cleanupErr) {
                console.error('[Stitch] Error limpiando carpeta temporal:', cleanupErr);
            }
        }
    }
};
