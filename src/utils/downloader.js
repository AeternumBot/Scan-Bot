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
     * Extrae el link de descarga directa de Mediafire o scrapea imágenes de páginas de capítulos.
     */
    async downloadFromFileHost(url, extractionFolder) {
        const targetDir = path.join(this.tempDir, extractionFolder);
        await fs.mkdir(targetDir, { recursive: true });

        // Si es Mediafire, usamos el método específico
        if (url.includes('mediafire.com')) {
            return await this._scrapeMediafire(url, extractionFolder);
        }

        // Para cualquier otra URL, intentamos scraping genérico de capítulo
        return await this._scrapeGenericChapter(url, extractionFolder);
    }

    /**
     * Mediafire: Extrae el link directo del botón de descarga.
     */
    async _scrapeMediafire(url, extractionFolder) {
        console.log(`[Downloader] Scrapeando Mediafire: ${url}`);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            const downloadUrl = await page.evaluate(() => {
                const btn = document.querySelector('#downloadButton');
                return btn ? btn.href : null;
            });

            if (!downloadUrl) {
                throw new Error("No se pudo extraer el link de descarga de Mediafire.");
            }

            console.log(`[Downloader] Link directo: ${downloadUrl}`);

            if (downloadUrl.toLowerCase().includes('.zip')) {
                return await this.downloadAndExtractZip(downloadUrl, extractionFolder);
            } else {
                const response = await axios({
                    url: downloadUrl,
                    method: 'GET',
                    responseType: 'arraybuffer'
                });
                const fileName = path.basename(new URL(downloadUrl).pathname) || 'mediafire_file';
                const filePath = path.join(targetDir, fileName);
                await fs.writeFile(filePath, response.data);
                return [filePath];
            }

        } catch (err) {
            console.error(`[Downloader] Error en Mediafire: ${err.message}`);
            throw new Error(`No pude descargar desde Mediafire: ${err.message}`);
        } finally {
            await browser.close();
        }
    }

    /**
     * Scraping genérico para páginas de capítulos de manhwa/manga.
     * Detecta y extrae imágenes de forma automática.
     */
    async _scrapeGenericChapter(url, extractionFolder) {
        console.log(`[Downloader] Scraping genérico de capítulo: ${url}`);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Detectar imágenes comunes en páginas de manga
            const imageSources = await page.evaluate(() => {
                const results = new Set();

                // Selectores comunes en páginas de manga/manhwa
                const selectors = [
                    // Omega Scans, MangaDex style
                    'img[src*="chapter"], img[src*=" manga"], img[src*="manhwa"], img[src*="webtoon"]',
                    'img[class*="chapter"], img[class*="pages"], img[class*="content"] img',
                    // Generico - imágenes dentro del contenido del capítulo
                    '.chapter-content img', '.page-break img', '.wp-manga-chapter-img',
                    '.container img[class*="img"]:not([src*="logo"]):not([src*="banner"])',
                    // Mangakakalot, manganato style
                    'div[style*="center"] img', '.vung-doc img',
                    // Generic img tags en área de contenido
                    '#chapter img', '.chapter-img img', '.viewer img',
                    'img[loading="lazy"]'
                ];

                selectors.forEach(sel => {
                    try {
                        document.querySelectorAll(sel).forEach(img => {
                            if (img.src && !img.src.includes('logo') && !img.src.includes('banner') &&
                                !img.src.includes('avatar') && !img.src.includes('icon')) {
                                results.add(img.src);
                            }
                        });
                    } catch (e) { /* selector inválido, ignorar */ }
                });

                // Fallback: todas las imágenes grandes en el body
                if (results.size === 0) {
                    document.querySelectorAll('img').forEach(img => {
                        if (img.width > 200 && img.height > 200 &&
                            !img.src.includes('logo') && !img.src.includes('banner') &&
                            !img.src.includes('avatar') && !img.src.includes('icon') &&
                            !img.src.includes('ads') && !img.src.includes('track')) {
                            results.add(img.src);
                        }
                    });
                }

                return Array.from(results);
            });

            console.log(`[Downloader] Imágenes detectadas: ${imageSources.length}`);

            if (imageSources.length === 0) {
                throw new Error("No se encontraron imágenes en la página. El sitio puede requerir login o usar JavaScript complejo.");
            }

            const downloadedPaths = [];
            let index = 1;

            for (const src of imageSources) {
                try {
                    const response = await axios({
                        url: src,
                        method: 'GET',
                        responseType: 'arraybuffer',
                        headers: {
                            'Referer': url,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 30000
                    });

                    const fileName = `pagina_${index.toString().padStart(3, '0')}.jpg`;
                    const filePath = path.join(targetDir, fileName);

                    await fs.writeFile(filePath, response.data);
                    downloadedPaths.push(filePath);
                    index++;

                    await new Promise(r => setTimeout(r, 150));

                } catch (err) {
                    console.warn(`[Downloader] Error descargando imagen ${src}: ${err.message}`);
                }
            }

            return downloadedPaths;

        } catch (err) {
            console.error(`[Downloader] Error en scraping genérico: ${err.message}`);
            throw err;
        } finally {
            await browser.close();
        }
    }
}

module.exports = DownloaderHub;

