module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-injects react-native-worklets/plugin (Reanimated
    // 4's worklet compiler) because react-native-worklets is installed.
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
