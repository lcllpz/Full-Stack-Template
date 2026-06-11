import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ui库
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
