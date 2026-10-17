const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Lovable sandboxes set METRO_CACHE_ROOT to a disk that survives restarts;
// unset (e.g. an exported project), Metro keeps its default tmpdir cache.
if (process.env.METRO_CACHE_ROOT) {
  const crypto = require("crypto");
  const fs = require("fs");
  const path = require("path");
  const { FileStore } = require("metro-cache");
  const root = process.env.METRO_CACHE_ROOT;
  // The platform invalidates Metro by deleting node_modules/.cache/metro; the
  // marker there names the live generation, so that clear rotates the store.
  const marker = path.join(__dirname, "node_modules", ".cache", "metro", ".metro-cache-root");
  const generationName = /^gen-[0-9a-f]{16}$/;
  try {
    if (!path.isAbsolute(root)) {
      throw new Error(`METRO_CACHE_ROOT must be an absolute path, got ${JSON.stringify(root)}`);
    }
    let generation = "";
    try {
      generation = fs.readFileSync(marker, "utf8").trim();
    } catch {}
    if (!generationName.test(generation)) {
      generation = `gen-${crypto.randomBytes(8).toString("hex")}`;
      fs.mkdirSync(path.dirname(marker), { recursive: true });
      fs.writeFileSync(marker, generation);
    }
    const store = path.join(root, generation);
    fs.mkdirSync(store, { recursive: true });
    // Any project secret can set METRO_CACHE_ROOT, so only directories this
    // block named are ever removed; the root itself is never deleted.
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory() && generationName.test(entry.name) && entry.name !== generation) {
        fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
      }
    }
    config.cacheStores = [new FileStore({ root: store })];
  } catch (error) {
    // Fall back to Metro's default store, which the platform's clears handle.
    console.warn(`metro.config.js: persisted cache disabled: ${error.message}`);
  }
}

module.exports = withNativeWind(config, { input: "./global.css" });
