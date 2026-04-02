const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const puppeteer = require('puppeteer');
const AdmZip = require('adm-zip');

class DownloaderHub {
    constructor() {
        // Carpeta temporal base para las descargas
        this.tempDir = path.join(__dirname, '..', '..', 'temp');
    }

    async init() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('Error creando carpeta temporal:', error);
        }
    }

    /**
     * Descarga imágenes directamente desde URLs provistas por adjuntos de Discord.
     */
    async downloadFromDiscordAttachments(attachments, extractionFolder) {
        const targetDir = path.join(this.tempDir, extractionFolder);
        await fs.mkdir(targetDir, { recursive: true });
        
        console.log(`[Downloader] Descargando ${attachments.length} adjuntos desde Discord...`);
        
        const downloadedPaths = [];
        let index = 1;
        
        for (const url of attachments) {
            try {
                // If it's a ZIP file, extract it instead of treating it as an image
                if (url.toLowerCase().endsWith('.zip')) {
                    const zipPaths = await this.downloadAndExtractZip(url, extractionFolder);
                    downloadedPaths.push(...zipPaths);
                    continue;
                }

                const response = await axios({
                    url,
                    method: 'GET',
                    responseType: 'arraybuffer'
                });
                
                // Extraer extensión de la URL, si no hay usar .png
                const ext = path.extname(new URL(url).pathname) || '.png';
                const fileName = `img_${index.toString().padStart(3, '0')}${ext}`;
                const filePath = path.join(targetDir, fileName);
                
                await fs.writeFile(filePath, response.data);
                downloadedPaths.push(filePath);
                index++;
            } catch (err) {
                console.error(`[Downloader] Error descargando adjunto ${url}:`, err.message);
            }
        }
        
        return downloadedPaths;
    }

    /**
     * Descarga un archivo ZIP y lo extrae en la carpeta especificada.
     */
    async downloadAndExtractZip(zipUrl, extractionFolder) {
        const targetDir = path.join(this.tempDir, extractionFolder);
        await fs.mkdir(targetDir, { recursive: true });

        console.log(`[Downloader] Descargando y extrayendo ZIP: ${zipUrl}`);

        try {
            const response = await axios({
                url: zipUrl,
                method: 'GET',
                responseType: 'arraybuffer'
            });

            const zip = new AdmZip(response.data);
            zip.extractAllTo(targetDir, true);

            // Devolver las rutas de los archivos extraídos (solo imágenes)
            const files = await fs.readdir(targetDir);
            return files
                .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
                .map(file => path.join(targetDir, file));

        } catch (err) {
            console.error(`[Downloader] Error procesando ZIP ${zipUrl}:`, err.message);
            return [];
        }
    }

    /**
     * Extrae imágenes crudas desde un capítulo de Comic Naver.
     * Naver bloquea el lazy loading y usa referers, por lo que usamos Puppeteer.
     */
    async scrapeFromNaver(comicUrl, extractionFolder) {
        const targetDir = path.join(this.tempDir, extractionFolder);
        await fs.mkdir(targetDir, { recursive: true });
        
        console.log(`[Downloader] Iniciando scrape con Puppeteer para Naver: ${comicUrl}`);
        
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // Ayuda mucho en RAM limitada
                '--disable-extensions'
            ]
        });
        
        try {
            const page = await browser.newPage();
            
            // Falsificamos un user-agent real
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Vamos a la url y esperamos que la red se calme
            await page.goto(comicUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // Las imágenes del capítulo suelen estar en el contenedor #section_cont -> .wt_viewer 
            // Esto puede cambiar, actualiza el selector si Naver cambia su UI web.
            const imageSources = await page.evaluate(() => {
                const imageNodes = document.querySelectorAll('.wt_viewer img');
                return Array.from(imageNodes).map(img => img.src);
            });
            
            console.log(`[Downloader] Se detectaron ${imageSources.length} imágenes en el capítulo.`);
            
            if (imageSources.length === 0) {
                throw new Error("No se encontraron imágenes. Posiblemente requiere login, captcha, o el selector CSS cambió.");
            }

            const downloadedPaths = [];
            let index = 1;

            // Para que Naver no nos bloquee, tenemos que setear un 'Referer' al bajarlas
            for (const src of imageSources) {
                try {
                    const response = await axios({
                        url: src,
                        method: 'GET',
                        responseType: 'arraybuffer',
                        headers: {
                            'Referer': comicUrl, // Muy importante en Naver
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    const fileName = `naver_${index.toString().padStart(3, '0')}.jpg`;
                    const filePath = path.join(targetDir, fileName);
                    
                    await fs.writeFile(filePath, response.data);
                    downloadedPaths.push(filePath);
                    index++;
                    
                    // Esperar unos ms para no inundar el servidor (cortesía web)
                    await new Promise(r => setTimeout(r, 200));

                } catch (err) {
                     console.error(`[Downloader] Error descargando imagen de Naver ${src}:`, err.message);
                }
            }
            
            return downloadedPaths;

        } catch (error) {
            console.error('[Downloader] Error maestro al escrapear Naver:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }

    /**
     * Extrae el link de descarga directa de Gofile o Mediafire y lo descarga.
     */
    async downloadFromFileHost(url, extractionFolder) {
        const targetDir = path.join(this.tempDir, extractionFolder);
        await fs.mkdir(targetDir, { recursive: true });

        console.log(`[Downloader] Intentando descargar desde hosting: ${url}`);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle2' });

            let downloadUrl = null;

            if (url.includes('mediafire.com')) {
                // Mediafire suele tener un botón 'Download' que es un link directo
                downloadUrl = await page.evaluate(() => {
                    const btn = document.querySelector('#downloadButton');
                    return btn ? btn.href : null;
                });
            } else if (url.includes('gofile.io')) {
                // Gofile es más dinámico, a veces hay que esperar a que los archivos cargen
                await page.waitForSelector('.mainContent', { timeout: 10000 });
                downloadUrl = await page.evaluate(() => {
                    // Esto es aproximado, Gofile cambia mucho
                    const dlBtn = document.querySelector('a[href*="dl.gofile.io"]');
                    return dlBtn ? dlBtn.href : null;
                });
            }

            if (!downloadUrl) {
                throw new Error("No se pudo extraer el link de descarga directa.");
            }

            console.log(`[Downloader] Link directo extraído: ${downloadUrl}`);

            // Si es un ZIP, lo descargamos y extraemos
            if (downloadUrl.toLowerCase().includes('.zip')) {
                return await this.downloadAndExtractZip(downloadUrl, extractionFolder);
            } else {
                // Si es un archivo individual (ej. una imagen suelta en el host)
                const response = await axios({
                    url: downloadUrl,
                    method: 'GET',
                    responseType: 'arraybuffer'
                });
                const fileName = path.basename(new URL(downloadUrl).pathname);
                const filePath = path.join(targetDir, fileName);
                await fs.writeFile(filePath, response.data);
                return [filePath];
            }

        } catch (err) {
            console.error(`[Downloader] Error procesando host ${url}:`, err.message);
            return [];
        } finally {
            await browser.close();
        }
    }
}

module.exports = DownloaderHub;

