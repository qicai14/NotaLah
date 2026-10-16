import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge the custom type scale in index.css; otherwise `text-body-sm` reads as a colour and a later
// size class would delete a text colour such as `text-primary-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ['caption', 'body-sm', 'body', 'title-sm', 'title', 'headline', 'display'] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
