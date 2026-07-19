import { useId } from 'react';

import type { ThemeId } from '../shared/contracts';

interface ThemeArtworkProps {
  readonly themeId: ThemeId;
  readonly className?: string;
}

export function ThemeArtwork({ themeId, className }: ThemeArtworkProps) {
  const gradientId = `theme-art-${useId().replaceAll(':', '')}`;

  return (
    <svg
      className={className}
      viewBox="0 0 360 180"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--theme-two)" />
          <stop offset="1" stopColor="var(--theme-four)" />
        </linearGradient>
      </defs>
      <rect width="360" height="180" fill={`url(#${gradientId})`} />
      {artworkFor(themeId)}
      <rect width="360" height="180" fill="none" stroke="rgb(255 255 255 / 9%)" />
    </svg>
  );
}

function artworkFor(themeId: ThemeId) {
  switch (themeId) {
    case 'minimal':
      return <>
        <path d="M0 133h360v47H0z" fill="var(--theme-one)" opacity=".18" />
        <path d="m113 125 56-83 58 83z" fill="var(--theme-one)" opacity=".9" />
        <circle cx="242" cy="82" r="33" fill="var(--theme-one)" opacity=".42" />
        <ellipse cx="181" cy="138" rx="93" ry="10" fill="#050706" opacity=".28" />
      </>;
    case 'nature':
      return <>
        <circle cx="282" cy="38" r="24" fill="var(--theme-one)" opacity=".68" />
        <path d="m0 143 74-78 43 40 62-71 68 73 40-43 73 75v41H0z" fill="var(--theme-three)" />
        <path d="m0 155 94-46 66 30 74-50 126 57v34H0z" fill="var(--theme-four)" opacity=".82" />
        <path d="m179 35-11 108h24z" fill="var(--theme-one)" opacity=".76" />
      </>;
    case 'architecture':
      return <>
        <path d="M28 42h132v138H28z" fill="var(--theme-one)" opacity=".86" />
        <path d="M160 72h172v108H160z" fill="var(--theme-three)" />
        <path d="M84 72h36v108H84zm122 37h78v71h-78z" fill="var(--theme-four)" />
        <path d="m28 42 132 30v22L28 66z" fill="#fff" opacity=".22" />
        <path d="M160 72h12v108h-12z" fill="var(--theme-two)" />
      </>;
    case 'cozy':
      return <>
        <path d="M0 122h360v58H0z" fill="var(--theme-four)" />
        <path d="M34 28h158v104H34z" fill="#151b22" />
        <path d="M45 39h136v82H45z" fill="var(--theme-three)" opacity=".72" />
        <path d="M113 39v82M45 80h136" stroke="var(--theme-one)" opacity=".35" />
        <path d="M225 125h92v16h-92zM238 141h8v39h-8zm58 0h8v39h-8z" fill="var(--theme-two)" />
        <path d="M270 44v54" stroke="var(--theme-one)" strokeWidth="4" />
        <path d="m246 98 24-38 24 38z" fill="var(--theme-one)" />
        <circle cx="270" cy="107" r="35" fill="var(--theme-one)" opacity=".18" />
      </>;
    case 'cosmic':
      return <>
        <circle cx="258" cy="81" r="54" fill="var(--theme-two)" />
        <ellipse cx="258" cy="81" rx="96" ry="20" fill="none" stroke="var(--theme-one)" strokeWidth="8" opacity=".72" transform="rotate(-14 258 81)" />
        <circle cx="80" cy="48" r="3" fill="#fff" /><circle cx="130" cy="115" r="2" fill="#fff" opacity=".7" />
        <circle cx="44" cy="137" r="1.8" fill="#fff" opacity=".7" /><circle cx="326" cy="27" r="2" fill="#fff" />
      </>;
    case 'sci-fi':
      return <>
        <path d="M0 138h360v42H0z" fill="var(--theme-four)" />
        <path d="m76 137 32-64h87l31 64z" fill="var(--theme-three)" />
        <path d="M124 88h55v49h-55z" fill="#132229" />
        <path d="M151 30v52m-28 0 28-24 30 24" stroke="var(--theme-one)" strokeWidth="4" fill="none" />
        <path d="M229 112h90v25h-90z" fill="var(--theme-two)" opacity=".7" />
        <circle cx="251" cy="124" r="5" fill="var(--theme-one)" /><circle cx="297" cy="124" r="5" fill="var(--theme-one)" />
      </>;
    case 'fantasy':
      return <>
        <path d="M52 75c51-34 97-20 129 5 39 30 81 18 123-7-19 59-59 91-126 88-66-3-104-31-126-86Z" fill="var(--theme-two)" />
        <path d="m112 146 46 34 31-45 28 45 25-47" fill="var(--theme-three)" />
        <path d="M150 74h43v62h-43zM171 43l34 33h-68z" fill="var(--theme-one)" opacity=".78" />
        <path d="M171 29v108" stroke="var(--theme-four)" strokeWidth="5" />
        <circle cx="280" cy="38" r="19" fill="var(--theme-one)" opacity=".82" />
      </>;
    case 'noir':
      return <>
        <path d="M0 121h360v59H0z" fill="#080a0b" />
        <path d="M38 38h95v105H38zm190-18h96v123h-96z" fill="var(--theme-four)" />
        <path d="M55 55h18v25H55zm35 0h18v25H90zm156-15h20v29h-20zm36 0h20v29h-20z" fill="var(--theme-one)" opacity=".28" />
        <path d="M178 42v108" stroke="var(--theme-one)" strokeWidth="5" /><path d="M178 46h37" stroke="var(--theme-one)" strokeWidth="5" />
        <path d="m155 180 23-63 24 63z" fill="var(--theme-one)" opacity=".14" />
        <path d="m12 19 72 161m14-180 72 180M210 0l72 180m18-180 55 124" stroke="#fff" opacity=".16" />
      </>;
    case 'abstract':
      return <>
        <circle cx="99" cy="86" r="66" fill="var(--theme-two)" opacity=".9" />
        <path d="M130 0h114l-75 180H55z" fill="var(--theme-three)" opacity=".82" />
        <circle cx="276" cy="78" r="51" fill="var(--theme-one)" opacity=".92" />
        <path d="M205 114h155v66H176z" fill="var(--theme-two)" opacity=".65" />
      </>;
    case 'surreal':
      return <>
        <path d="M0 135h360v45H0z" fill="var(--theme-one)" opacity=".4" />
        <path d="M131 35h98v124h-98z" fill="var(--theme-four)" />
        <path d="M145 49h70v110h-70z" fill="var(--theme-one)" opacity=".72" />
        <path d="m180 64 82 96H98z" fill="var(--theme-three)" opacity=".54" />
        <ellipse cx="77" cy="48" rx="40" ry="18" fill="var(--theme-one)" />
        <ellipse cx="291" cy="87" rx="29" ry="50" fill="var(--theme-two)" opacity=".8" />
      </>;
    case 'seasonal':
      return <>
        <path d="M0 139h360v41H0z" fill="var(--theme-four)" opacity=".6" />
        <path d="M180 74v106" stroke="var(--theme-four)" strokeWidth="14" />
        <path d="m180 111-52-41m52 62 65-55" stroke="var(--theme-four)" strokeWidth="8" />
        <circle cx="119" cy="55" r="38" fill="var(--theme-two)" /><circle cx="175" cy="44" r="48" fill="var(--theme-one)" />
        <circle cx="235" cy="62" r="43" fill="var(--theme-two)" /><circle cx="156" cy="91" r="42" fill="var(--theme-three)" opacity=".8" />
        <circle cx="70" cy="27" r="15" fill="#fff" opacity=".64" /><circle cx="303" cy="37" r="12" fill="#fff" opacity=".55" />
      </>;
    case 'illustrated':
      return <>
        <circle cx="276" cy="41" r="25" fill="var(--theme-one)" />
        <path d="m0 134 79-62 49 42 62-79 78 78 34-29 58 50v46H0z" fill="var(--theme-three)" stroke="var(--theme-four)" strokeWidth="4" />
        <path d="M68 112h65v52H68z" fill="var(--theme-two)" stroke="var(--theme-four)" strokeWidth="4" />
        <path d="m56 112 44-37 45 37z" fill="var(--theme-one)" stroke="var(--theme-four)" strokeWidth="4" />
        <path d="M94 133h17v31H94z" fill="var(--theme-four)" />
      </>;
    case 'anime-waifu':
      return <>
        <circle cx="180" cy="74" r="46" fill="var(--theme-one)" />
        <path d="M132 77c0-52 25-70 50-70 31 0 55 26 52 80l-18 30-11-49-72 50Z" fill="var(--theme-four)" />
        <path d="M126 180c4-57 24-77 54-77s51 20 57 77Z" fill="var(--theme-three)" />
        <path d="m159 108 21 18 22-18 12 25-34 20-34-20Z" fill="var(--theme-two)" />
        <path d="M163 72h10m17 0h10" stroke="var(--theme-four)" strokeWidth="4" strokeLinecap="round" />
        <path d="M173 91c5 4 10 4 15 0" stroke="var(--theme-four)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="280" cy="48" r="24" fill="var(--theme-two)" opacity=".7" />
      </>;
  }
}
