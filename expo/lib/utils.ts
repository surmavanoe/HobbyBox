import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// NativeWind applies conflicting utilities in stylesheet order, not className order.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
