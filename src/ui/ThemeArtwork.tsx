import type { ThemeId } from '../shared/contracts';

import abstractArtwork from './theme-art/abstract.webp';
import animeWaifuArtwork from './theme-art/anime-waifu.webp';
import architectureArtwork from './theme-art/architecture.webp';
import cosmicArtwork from './theme-art/cosmic.webp';
import cozyArtwork from './theme-art/cozy.webp';
import fantasyArtwork from './theme-art/fantasy.webp';
import illustratedArtwork from './theme-art/illustrated.webp';
import minimalArtwork from './theme-art/minimal.webp';
import natureArtwork from './theme-art/nature.webp';
import noirArtwork from './theme-art/noir.webp';
import sciFiArtwork from './theme-art/sci-fi.webp';
import seasonalArtwork from './theme-art/seasonal.webp';
import surrealArtwork from './theme-art/surreal.webp';

interface ThemeArtworkProps {
  readonly themeId: ThemeId;
  readonly className?: string;
  readonly eager?: boolean;
}

const THEME_ARTWORK = {
  minimal: minimalArtwork,
  nature: natureArtwork,
  architecture: architectureArtwork,
  cozy: cozyArtwork,
  cosmic: cosmicArtwork,
  'sci-fi': sciFiArtwork,
  fantasy: fantasyArtwork,
  noir: noirArtwork,
  abstract: abstractArtwork,
  surreal: surrealArtwork,
  seasonal: seasonalArtwork,
  illustrated: illustratedArtwork,
  'anime-waifu': animeWaifuArtwork,
} satisfies Record<ThemeId, string>;

export function ThemeArtwork({ themeId, className, eager = false }: ThemeArtworkProps) {
  return (
    <img
      className={['theme-artwork', className].filter(Boolean).join(' ')}
      src={THEME_ARTWORK[themeId]}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
