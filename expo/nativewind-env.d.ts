/// <reference types="nativewind/types" />

// Lets the side-effect CSS import (NativeWind global.css) typecheck under strict.
declare module "*.css";

// Metro resolves image imports to asset sources; expo/types ships no declarations for them.
declare module "*.png" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}
declare module "*.jpg" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}
declare module "*.jpeg" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}
declare module "*.webp" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}
declare module "*.gif" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}
