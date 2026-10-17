import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { cn } from "@/lib/utils";

interface TextProps extends RNTextProps {
  variant?: "default" | "title" | "subtitle" | "caption";
}

const variantStyles = {
  default: "text-base text-foreground",
  title: "text-2xl font-bold text-foreground",
  subtitle: "text-lg font-semibold text-foreground",
  caption: "text-sm text-muted-foreground",
};

export function Text({ variant = "default", className, ...props }: TextProps) {
  return <RNText className={cn(variantStyles[variant], className)} {...props} />;
}
