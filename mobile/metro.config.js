const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Defer module evaluation until the module is actually used. In particular,
// the PDF export engine should not run while the calculator is starting.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
