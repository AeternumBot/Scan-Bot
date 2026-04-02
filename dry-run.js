try {
    console.log("Checking Stitcher...");
    require('./src/utils/stitcher');
    console.log("Checking Downloader...");
    require('./src/utils/downloader');
    console.log("Checking Command...");
    require('./src/commands/stitch');
    console.log("✅ All files are valid and dependencies are resolvable.");
} catch (err) {
    console.error("❌ Error loading modules:");
    console.error(err);
    process.exit(1);
}
