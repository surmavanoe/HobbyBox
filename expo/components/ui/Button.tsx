import { Pressable, type PressableProps } from "react-native";

import { cn } from "@/lib/utils";

import { Text } from "./Text";

interface ButtonProps extends PressableProps {
  variant?: "default" | "tinted" | "ghost";
  children: string;
}

const baseStyles = "min-h-[44px] items-center justify-center rounded-xl px-4 py-3";

// Tinted pressed state stops at 18% in dark mode: the label falls under 4.5:1 on a card beyond that.
const variantStyles = {
  default: "bg-primary active:bg-primary/90",
  tinted: "bg-primary/15 active:bg-primary/20 dark:active:bg-primary/[0.18]",
  ghost: "active:bg-secondary",
};

const textVariantStyles = {
  default: "font-semibold text-primary-foreground",
  tinted: "font-semibold text-primary",
  ghost: "text-primary",
};

export function Button({ variant = "default", children, className, ...props }: ButtonProps) {
  return (
    <Pressable className={cn(baseStyles, variantStyles[variant], className)} {...props}>
      <Text className={textVariantStyles[variant]}>{children}</Text>
    </Pressable>
  );
}
