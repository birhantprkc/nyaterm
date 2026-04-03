import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseJsonSearchParam<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    // URLSearchParams.get() already returns a decoded value.
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Failed to parse JSON search param", error);
    return null;
  }
}
