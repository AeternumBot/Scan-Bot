const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const SmartStitcher = require('./stitcher');

async function createDummyImage(text, color, height) {
    // Generate a temporary SVG with some text and a background color
    const svg = `
    <svg width="720" height="${height}">
      <rect x="0" y="0" width="720" height="${height}" fill="${color}" />
      <text x="360" y="${height / 2}" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dominant-baseline="middle">
        ${text}
      </text>
    </svg>`;
    return await sharp(Buffer.from(svg)).toFormat('jpg').toBuffer();
}

async function runTest() {
    console.log("Iniciando prueba del SmartStitcher...");
    
    // 1. Crear 3 imágenes de prueba
    console.log("Creando imágenes de prueba...");
    const img1 = await createDummyImage('Página 1 (Parte de Arriba)', '#3498db', 3000);
    const img2 = await createDummyImage('Página 2 (Medio - Debería Cortar Aquí)', '#2ecc71', 5000);
    const img3 = await createDummyImage('Página 3 (Abajo)', '#e74c3c', 4000);
    
    const buffers = [img1, img2, img3];

    // 2. Ejecutar Stitcher
    const stitcher = new SmartStitcher({
        enforceWidth: 720,
        splitHeight: 4000, // Forzamos un corto máximo bajito para forzar cortes
        outputFormat: 'jpg'
    });

    const results = await stitcher.process(buffers);

    // 3. Guardar en disco para verificar
    console.log(`Guardando ${results.length} resultados temporales...`);
    for (let i = 0; i < results.length; i++) {
        const outPath = path.join(__dirname, `stitch_test_result_${i+1}.jpg`);
        await fs.writeFile(outPath, results[i]);
        console.log(`✅ Guardado: ${outPath}`);
    }

    console.log("¡Prueba de Fase 1 Completada con éxito!");
}

runTest().catch(err => console.error("Error en la prueba:", err));
