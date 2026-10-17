import { TextInput, type TextInputProps } from "react-native";

import { cn } from "@/lib/utils";

interface InputProps extends TextInputProps {
  className?: string;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        "min-h-[44px] rounded-xl bg-input px-4 py-3 text-base text-foreground placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
