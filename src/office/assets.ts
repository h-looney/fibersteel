import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

/** Optimized image URLs built by Astro at compile time and passed into the app. */
export interface Assets {
  logo: string;
  mark: string;
  signin: string;
  avatars: Record<string, string>;
  photos: Record<string, string>;
}

export const AssetsContext = createContext<Assets>({ logo: '', mark: '', signin: '', avatars: {}, photos: {} });
export const useAssets = () => useContext(AssetsContext);
