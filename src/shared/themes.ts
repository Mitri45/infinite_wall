import {
  type SceneSeed,
  type ThemeId,
  type ThemePack,
  themePackSchema,
} from './contracts';

const defineTheme = (theme: ThemePack): ThemePack => themePackSchema.parse(theme);

export const THEME_PACKS = [
  defineTheme({
    id: 'minimal',
    name: 'Minimal',
    collection: 'Quiet Form',
    description: 'Measured space, tactile materials, and one beautifully resolved idea.',
    palette: ['#e8e1d7', '#b7aa9b', '#72786f', '#252a27'],
    mood: ['quiet', 'precise', 'restorative'],
    subjects: ['sculptural objects', 'paper forms', 'soft architectural shadows'],
    composition: 'Use generous negative space, a single focal gesture, restrained depth, and no text or logos.',
    sceneSeeds: [
      {
        id: 'minimal-folded-light',
        title: 'Folded Light',
        summary: 'An ivory paper plane shaped by one long morning shadow.',
        prompt: 'An original ivory paper sculpture on warm plaster, one long soft morning shadow, generous empty space, tactile editorial photography.',
        weight: 1.2,
      },
      {
        id: 'minimal-river-stone',
        title: 'River Stone',
        summary: 'A balanced river stone and brushed steel study in muted grey.',
        prompt: 'A smooth river stone balanced beside a thin brushed-steel arc, muted grey studio, calm asymmetrical composition, subtle film grain.',
        weight: 1,
      },
      {
        id: 'minimal-clay-horizon',
        title: 'Clay Horizon',
        summary: 'Terracotta planes meet in a low, sun-warmed geometric horizon.',
        prompt: 'Low terracotta planes meeting like a distant horizon, warm side light, simple geometric landscape, broad negative space, refined material detail.',
        weight: 0.9,
      },
      {
        id: 'minimal-glass-orbit',
        title: 'Glass Orbit',
        summary: 'A translucent sphere hovers over a charcoal linen surface.',
        prompt: 'A single translucent glass sphere hovering over charcoal linen, faint circular caustic, dark restrained palette, premium still-life photography.',
        weight: 1,
      },
    ],
  }),
  defineTheme({
    id: 'nature',
    name: 'Nature',
    collection: 'Wild Distance',
    description: 'Weather, terrain, and living detail without postcard clichés.',
    palette: ['#d9d6b7', '#7f9b74', '#345c4a', '#142c25'],
    mood: ['alive', 'grounded', 'expansive'],
    subjects: ['remote landscapes', 'botanical detail', 'water and weather'],
    composition: 'Build deep atmospheric layers with a calm horizon and room for desktop icons; avoid famous landmarks.',
    sceneSeeds: [
      {
        id: 'nature-mist-fern',
        title: 'Fern Weather',
        summary: 'Silver mist threads through a fern-filled temperate ravine.',
        prompt: 'A secluded temperate ravine filled with giant ferns, silver mist threading between wet leaves, deep green atmospheric layers, cinematic natural light.',
        weight: 1.1,
      },
      {
        id: 'nature-tidal-mirror',
        title: 'Tidal Mirror',
        summary: 'A still tidal flat reflects a pale sky and distant grass islands.',
        prompt: 'A quiet tidal flat at first light, pale sky mirrored in still water, small islands of wind-shaped grass, minimal horizon, soft natural color.',
        weight: 1,
      },
      {
        id: 'nature-alpine-rain',
        title: 'Alpine Rain',
        summary: 'Rain curtains move across an unnamed alpine basin.',
        prompt: 'An unnamed alpine basin under passing rain curtains, dark stone, luminous moss, distant peaks partly hidden, wide cinematic framing.',
        weight: 1,
      },
      {
        id: 'nature-desert-bloom',
        title: 'Desert Bloom',
        summary: 'Tiny desert flowers scatter across sculpted ochre ground after rain.',
        prompt: 'A broad ochre desert after rare rain, tiny original wildflowers scattered across wind-sculpted ground, low evening light, intimate but expansive.',
        weight: 0.9,
      },
    ],
  }),
  defineTheme({
    id: 'architecture',
    name: 'Architecture',
    collection: 'Human Scale',
    description: 'Original spaces shaped by light, material, rhythm, and inhabitation.',
    palette: ['#e6d5bf', '#c47c5a', '#5d7180', '#222a30'],
    mood: ['structured', 'sunlit', 'contemplative'],
    subjects: ['original buildings', 'interior courtyards', 'material studies'],
    composition: 'Favor strong perspective, repeating rhythm, and believable original design; exclude recognizable buildings.',
    sceneSeeds: [
      {
        id: 'architecture-coral-courtyard',
        title: 'Coral Courtyard',
        summary: 'Curved coral walls frame a narrow courtyard pool at noon.',
        prompt: 'An original courtyard of curved coral-toned walls and a narrow reflecting pool, hard noon shadows, human-scale modern architecture, no people.',
        weight: 1,
      },
      {
        id: 'architecture-rain-library',
        title: 'Rain Library',
        summary: 'A timber reading room looks into a rain-dark inner garden.',
        prompt: 'An original timber library interior looking into a small rain-dark garden, warm shelves, cool window light, quiet contemporary architecture.',
        weight: 1.1,
      },
      {
        id: 'architecture-cliff-house',
        title: 'Cliff House',
        summary: 'A compact concrete house folds into a windy basalt slope.',
        prompt: 'A compact original concrete dwelling folded into a basalt hillside, windswept grass, overcast sea light, bold horizontal composition.',
        weight: 0.9,
      },
      {
        id: 'architecture-blue-stair',
        title: 'Blue Stair',
        summary: 'A cobalt stair cuts diagonally through a pale stone atrium.',
        prompt: 'A vivid cobalt staircase crossing a pale limestone atrium, original geometric architecture, sharp diagonal rhythm, clean editorial photography.',
        weight: 1,
      },
    ],
  }),
  defineTheme({
    id: 'cozy',
    name: 'Cozy',
    collection: 'Small Hours',
    description: 'Warm, lived-in refuges with rain outside and nowhere else to be.',
    palette: ['#f0c987', '#c7794f', '#6a493f', '#292225'],
    mood: ['warm', 'sheltered', 'unhurried'],
    subjects: ['reading corners', 'small cabins', 'late-night kitchens'],
    composition: 'Layer pools of warm light and tactile objects while retaining a quiet area for desktop icons.',
    sceneSeeds: [
      {
        id: 'cozy-window-seat',
        title: 'Window Weather',
        summary: 'Rain beads on a wide window beside blankets and an open book.',
        prompt: 'A deep window seat with rumpled wool blankets and an open book, rain beads on dark glass, amber lamp light, intimate original interior.',
        weight: 1.2,
      },
      {
        id: 'cozy-cabin-stove',
        title: 'Stove Light',
        summary: 'A tiny timber cabin glows around a cast-iron stove before dawn.',
        prompt: 'Inside a tiny original timber cabin before dawn, cast-iron stove glowing, boots drying nearby, quiet blue snow beyond the window.',
        weight: 1,
      },
      {
        id: 'cozy-midnight-kitchen',
        title: 'Midnight Kitchen',
        summary: 'A small tiled kitchen holds one pool of honey-colored light.',
        prompt: 'A compact tiled kitchen at midnight, one honey-colored pendant light, steaming mug and sliced citrus, deep surrounding shadow, cinematic stillness.',
        weight: 1,
      },
      {
        id: 'cozy-greenhouse',
        title: 'Glasshouse Tea',
        summary: 'Tea waits inside a plant-filled glasshouse during soft rain.',
        prompt: 'A small plant-filled glasshouse in soft rain, worn wooden table with tea, fogged panes, layered foliage, gentle warm and cool contrast.',
        weight: 0.9,
      },
    ],
  }),
  defineTheme({
    id: 'cosmic',
    name: 'Cosmic',
    collection: 'Deep Quiet',
    description: 'Vast astronomical scenes rendered with awe, restraint, and scale.',
    palette: ['#f2c8ff', '#8b78df', '#344183', '#11142f'],
    mood: ['vast', 'luminous', 'meditative'],
    subjects: ['distant nebulae', 'unfamiliar planets', 'stellar phenomena'],
    composition: 'Use strong celestial scale, subtle scientific plausibility, and dark regions suitable for desktop icons.',
    sceneSeeds: [
      {
        id: 'cosmic-violet-ring',
        title: 'Violet Ring',
        summary: 'A thin lavender ring system crosses a shadowed ice giant.',
        prompt: 'An original shadowed ice giant with an impossibly thin lavender ring system, distant particulate glow, restrained deep-space palette, enormous scale.',
        weight: 1,
      },
      {
        id: 'cosmic-stellar-nursery',
        title: 'First Light',
        summary: 'New stars ignite within pillars of translucent amber dust.',
        prompt: 'A distant stellar nursery where tiny new stars ignite inside translucent amber dust pillars, physically inspired detail, broad dark negative space.',
        weight: 1.1,
      },
      {
        id: 'cosmic-ocean-moon',
        title: 'Ocean Moon',
        summary: 'A dark ocean moon reflects its giant blue parent planet.',
        prompt: 'The night side of an original ocean moon, its black water reflecting a huge blue parent planet above the horizon, sparse stars, serene scale.',
        weight: 1,
      },
      {
        id: 'cosmic-gravity-lens',
        title: 'Bent Horizon',
        summary: 'A remote galaxy arcs into a delicate gravitational lens.',
        prompt: 'A remote galaxy distorted into a delicate gravitational lens around invisible mass, indigo-black space, subtle scientific visualization, elegant composition.',
        weight: 0.8,
      },
    ],
  }),
  defineTheme({
    id: 'sci-fi',
    name: 'Sci-fi',
    collection: 'Future Field Notes',
    description: 'Believable futures with original machines, places, and human traces.',
    palette: ['#d7fff1', '#58d6bd', '#287f86', '#142d3b'],
    mood: ['inventive', 'clean', 'mysterious'],
    subjects: ['future infrastructure', 'research outposts', 'original vehicles'],
    composition: 'Create functional, unfamiliar technology with cinematic scale; no franchise aesthetics, marks, or characters.',
    sceneSeeds: [
      {
        id: 'sci-fi-cloud-harbor',
        title: 'Cloud Harbor',
        summary: 'Silent research skiffs dock above a planet-wide cloud deck.',
        prompt: 'Original silent research skiffs docked at a high-altitude platform above a vast cloud deck, clean functional design, pale morning atmosphere.',
        weight: 1.1,
      },
      {
        id: 'sci-fi-seed-vault',
        title: 'Seed Vault 9',
        summary: 'A bioluminescent seed archive runs beneath an arid plateau.',
        prompt: 'An underground future seed archive beneath an arid plateau, translucent storage columns, bioluminescent plants, believable utilitarian technology.',
        weight: 1,
      },
      {
        id: 'sci-fi-tidal-array',
        title: 'Tidal Array',
        summary: 'Geometric energy collectors stand in a silver extraterrestrial sea.',
        prompt: 'A field of original geometric energy collectors standing in a shallow silver alien sea, distant storm, teal navigation lights, wide cinematic view.',
        weight: 0.9,
      },
      {
        id: 'sci-fi-orbital-garden',
        title: 'Orbital Garden',
        summary: 'A rotating greenhouse corridor opens toward a rust-colored planet.',
        prompt: 'Inside an original rotating orbital greenhouse, curved planted corridor and condensation, rust-colored planet through the windows, calm lived-in future.',
        weight: 1,
      },
    ],
  }),
  defineTheme({
    id: 'fantasy',
    name: 'Fantasy',
    collection: 'Unwritten Realms',
    description: 'Mythic original worlds built from atmosphere, wonder, and ancient scale.',
    palette: ['#ffd7a8', '#a88bc9', '#58669d', '#252744'],
    mood: ['mythic', 'enchanted', 'ancient'],
    subjects: ['original realms', 'impossible natural monuments', 'mysterious ruins'],
    composition: 'Center environmental storytelling and wonder; avoid named characters, recognizable creatures, and franchise visual language.',
    sceneSeeds: [
      {
        id: 'fantasy-floating-orchard',
        title: 'Sky Orchard',
        summary: 'Fruit trees grow across slow-floating islands at golden hour.',
        prompt: 'An original orchard growing across small slow-floating islands, roots trailing in luminous mist, golden-hour sky, vast gentle fantasy landscape.',
        weight: 1.1,
      },
      {
        id: 'fantasy-tide-temple',
        title: 'Temple of Tides',
        summary: 'Moonlit stairs descend beneath a sea that parts around them.',
        prompt: 'Ancient original stone stairs descending beneath a moonlit sea that parts in tall translucent walls, no figures, mysterious blue-silver atmosphere.',
        weight: 1,
      },
      {
        id: 'fantasy-giant-bell',
        title: 'The Sleeping Bell',
        summary: 'A moss-covered bronze bell rests between enormous old trees.',
        prompt: 'A colossal weathered bronze bell resting in an ancient forest, moss and tiny flowers across its surface, shafts of dawn light, original folklore mood.',
        weight: 0.9,
      },
      {
        id: 'fantasy-glass-river',
        title: 'Glass River',
        summary: 'A transparent river winds upward through a violet mountain pass.',
        prompt: 'A transparent river flowing upward through a violet mountain pass, luminous stones suspended inside, sweeping original fantasy landscape, quiet awe.',
        weight: 1,
      },
    ],
  }),
  defineTheme({
    id: 'noir',
    name: 'Noir',
    collection: 'After Midnight',
    description: 'Rain, geometry, and unanswered questions in mostly monochrome worlds.',
    palette: ['#dedbd3', '#8d9190', '#4b5357', '#15191c'],
    mood: ['tense', 'cinematic', 'solitary'],
    subjects: ['rain-dark streets', 'empty transit spaces', 'architectural shadows'],
    composition: 'Use hard pools of light, reflective surfaces, graphic shadow, and anonymous original locations without violence.',
    sceneSeeds: [
      {
        id: 'noir-last-tram',
        title: 'Last Tram',
        summary: 'An empty tram waits beneath rain and a single station clock.',
        prompt: 'An original empty tram at a rain-dark terminal, one glowing station clock, wet rails, monochrome cinematic lighting, no visible branding.',
        weight: 1,
      },
      {
        id: 'noir-hotel-corridor',
        title: 'Room 808',
        summary: 'A long hotel corridor turns just before its final pool of light.',
        prompt: 'A long anonymous hotel corridor at night, patterned carpet fading into shadow, one warm doorway around a distant corner, elegant noir geometry.',
        weight: 0.9,
      },
      {
        id: 'noir-rooftop-antenna',
        title: 'Night Signal',
        summary: 'Old antennas cut across fog above an unnamed city.',
        prompt: 'Old rooftop antennas silhouetted against luminous city fog, wet concrete, distant windows, original monochrome urban scene, broad negative sky.',
        weight: 1,
      },
      {
        id: 'noir-underpass',
        title: 'Underpass',
        summary: 'Reflected fluorescent lines disappear into a flooded pedestrian tunnel.',
        prompt: 'An empty pedestrian underpass with a thin layer of rainwater, fluorescent reflections disappearing into darkness, stark black-and-white composition.',
        weight: 1.1,
      },
    ],
  }),
  defineTheme({
    id: 'abstract',
    name: 'Abstract',
    collection: 'Color in Motion',
    description: 'Expressive fields of color, depth, rhythm, and material surprise.',
    palette: ['#ffcf67', '#f06f78', '#745edb', '#263383'],
    mood: ['energetic', 'fluid', 'immersive'],
    subjects: ['color fields', 'material experiments', 'optical depth'],
    composition: 'Build a clear visual rhythm at wallpaper scale with varied quiet and active zones; never include text or marks.',
    sceneSeeds: [
      {
        id: 'abstract-ink-current',
        title: 'Ink Current',
        summary: 'Cobalt and saffron currents fold through translucent depth.',
        prompt: 'Abstract cobalt and saffron currents folding through translucent depth, macro ink physics, crisp detail and soft diffusion, elegant wide composition.',
        weight: 1.1,
      },
      {
        id: 'abstract-felt-spectrum',
        title: 'Soft Spectrum',
        summary: 'Layered felt ridges form a warm topographic color field.',
        prompt: 'Layered hand-cut felt ridges forming an abstract topographic field, warm spectral color progression, tactile fibers, raking studio light.',
        weight: 1,
      },
      {
        id: 'abstract-chrome-ribbon',
        title: 'Chrome Ribbon',
        summary: 'A liquid chrome ribbon bends through a dark apricot haze.',
        prompt: 'A single liquid chrome ribbon bending through dark apricot haze, abstract reflective study, dramatic depth, controlled minimal composition.',
        weight: 0.9,
      },
      {
        id: 'abstract-prism-noise',
        title: 'Prism Noise',
        summary: 'Fine prismatic grains gather into a luminous diagonal wave.',
        prompt: 'Millions of fine prismatic grains gathering into one luminous diagonal wave, deep navy field, precise generative abstraction, high spatial detail.',
        weight: 1,
      },
    ],
  }),
  defineTheme({
    id: 'surreal',
    name: 'Surreal',
    collection: 'Gentle Impossibilities',
    description: 'Dream logic made serene, tactile, and strangely believable.',
    palette: ['#f5cabf', '#c08ab7', '#7276a8', '#303150'],
    mood: ['dreamlike', 'uncanny', 'serene'],
    subjects: ['impossible rooms', 'altered landscapes', 'unexpected scale'],
    composition: 'Make one impossible relationship feel physically convincing; keep the scene calm, original, and non-disturbing.',
    sceneSeeds: [
      {
        id: 'surreal-indoor-tide',
        title: 'Indoor Tide',
        summary: 'A quiet ocean tide moves through a sunlit apartment.',
        prompt: 'A serene ocean tide moving through an original sunlit apartment, curtains floating just above the water, photoreal dream logic, soft afternoon color.',
        weight: 1.1,
      },
      {
        id: 'surreal-cloud-stairs',
        title: 'Cloud Stairs',
        summary: 'A narrow staircase casts a shadow across a solid cloud field.',
        prompt: 'A narrow freestanding staircase crossing a solid field of soft clouds, long precise shadow, pale blue dreamscape, quiet impossible architecture.',
        weight: 1,
      },
      {
        id: 'surreal-giant-pear',
        title: 'Orchard Moon',
        summary: 'A giant pale pear rises like a moon behind a small orchard.',
        prompt: 'A giant pale pear rising like a moon behind a tiny orderly orchard, misty dusk, whimsical original surreal landscape, refined photographic detail.',
        weight: 0.8,
      },
      {
        id: 'surreal-folded-lake',
        title: 'Folded Lake',
        summary: 'A mountain lake lifts at one edge like a sheet of blue glass.',
        prompt: 'A pristine mountain lake lifting at one edge like a flexible sheet of blue glass, realistic reflections, empty shore, restrained surreal composition.',
        weight: 1,
      },
    ],
  }),
  defineTheme({
    id: 'seasonal',
    name: 'Seasonal',
    collection: 'Turning Year',
    description: 'The particular light, weather, and rituals that make seasons felt.',
    palette: ['#f4df9c', '#dd8c5d', '#8a5b55', '#31485e'],
    mood: ['nostalgic', 'fresh', 'atmospheric'],
    subjects: ['seasonal weather', 'changing plants', 'quiet rituals'],
    composition: 'Convey a season through light and small natural detail, not holiday symbols, text, or commercial imagery.',
    sceneSeeds: [
      {
        id: 'seasonal-first-frost',
        title: 'First Frost',
        summary: 'Frost edges a meadow while the last warm grasses catch sunrise.',
        prompt: 'First frost edging a quiet meadow, last amber grasses catching sunrise, low blue shadow, finely detailed transitional-season landscape.',
        weight: 1,
      },
      {
        id: 'seasonal-summer-storm',
        title: 'Summer Storm',
        summary: 'Warm rain crosses an orchard under a luminous green sky.',
        prompt: 'Warm summer rain crossing a small orchard, luminous green storm light, wet leaves and distant haze, expansive original countryside.',
        weight: 1.1,
      },
      {
        id: 'seasonal-autumn-window',
        title: 'Amber Window',
        summary: 'Windblown leaves gather outside a workshop window at dusk.',
        prompt: 'Windblown amber leaves gathering outside an old workshop window, blue dusk and warm interior glow, tactile seasonal still life.',
        weight: 0.9,
      },
      {
        id: 'seasonal-spring-melt',
        title: 'Meltwater',
        summary: 'Clear meltwater threads beneath snow and new green shoots.',
        prompt: 'Clear spring meltwater threading beneath thinning snow, tiny green shoots and dark soil, close atmospheric landscape, crisp gentle light.',
        weight: 1,
      },
    ],
  }),
  defineTheme({
    id: 'illustrated',
    name: 'Illustrated',
    collection: 'Drawn Worlds',
    description: 'Original graphic worlds with visible craft and a strong narrative spark.',
    palette: ['#ffe09f', '#f18c70', '#478b8c', '#263b53'],
    mood: ['playful', 'crafted', 'story-rich'],
    subjects: ['invented places', 'small everyday stories', 'graphic landscapes'],
    composition: 'Use an original illustrative language, confident shapes, and readable depth; avoid imitation of living artists or known properties.',
    sceneSeeds: [
      {
        id: 'illustrated-night-market',
        title: 'Lantern Market',
        summary: 'Tiny food stalls glow along a canal in an invented hill town.',
        prompt: 'Original gouache-style illustration of tiny food stalls glowing beside a canal in an invented hill town, bold shapes, warm night palette, no text.',
        weight: 1.1,
      },
      {
        id: 'illustrated-bicycle-cloud',
        title: 'Cloud Courier',
        summary: 'A bicycle courier crosses a bridge between soft geometric clouds.',
        prompt: 'Original screen-print illustration of a tiny bicycle courier crossing a bridge between soft geometric clouds, limited colors, playful wide composition.',
        weight: 0.9,
      },
      {
        id: 'illustrated-green-train',
        title: 'Valley Line',
        summary: 'A small green train winds through oversized fields and villages.',
        prompt: 'Original cut-paper-style illustration of a small green train winding through oversized patchwork fields and tiny villages, tactile layered shapes.',
        weight: 1,
      },
      {
        id: 'illustrated-rooftop-garden',
        title: 'Rooftop Season',
        summary: 'Neighbors tend an exuberant garden above a dense invented city.',
        prompt: 'Original colored-pencil illustration of an exuberant rooftop garden above a dense invented city, tiny anonymous figures, breezy afternoon, rich detail.',
        weight: 1,
      },
    ],
  }),
] as const satisfies readonly ThemePack[];

const THEME_BY_ID = new Map<ThemeId, ThemePack>(
  THEME_PACKS.map((theme) => [theme.id, theme]),
);

export function getThemePack(id: ThemeId): ThemePack {
  const theme = THEME_BY_ID.get(id);

  if (!theme) {
    throw new Error(`Unknown theme: ${id}`);
  }

  return theme;
}

export function selectWeightedScene(
  theme: ThemePack,
  recentSummaries: readonly string[],
  random: () => number = Math.random,
): SceneSeed {
  const normalizedRecent = new Set(
    recentSummaries.map((summary) => summary.trim().toLocaleLowerCase()),
  );
  const unseen = theme.sceneSeeds.filter(
    (scene) => !normalizedRecent.has(scene.summary.toLocaleLowerCase()),
  );
  const candidates = unseen.length > 0 ? unseen : theme.sceneSeeds;
  const totalWeight = candidates.reduce((total, scene) => total + scene.weight, 0);
  let cursor = Math.min(Math.max(random(), 0), 0.999_999) * totalWeight;

  for (const scene of candidates) {
    cursor -= scene.weight;
    if (cursor < 0) {
      return scene;
    }
  }

  return candidates[candidates.length - 1];
}
