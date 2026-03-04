# Assets Directory

## Directory Layout

```
assets/
├── prompts/              AI generation prompt text files
│   ├── units/            8 prompts: {unittype}_{faction}.md
│   ├── tiles/            10 prompts: {terrain}_v{n}.md + objective_v1.md
│   ├── icons/            4 prompts: {unittype}_icon.md
│   └── effects/          2 prompts: explosion.md, damage_font.md
├── units/                Generated unit sprites
│   ├── engineer/         Engineer faction unit sprites
│   └── caravaner/        Caravaner faction unit sprites
├── tiles/                Generated terrain tile sprites
├── icons/                Pixel art unit type icons (faction-neutral)
├── effects/              Effect sprites (explosion, damage font)
└── kenney_hexagon-pack/  Reference tileset (Kenney)
```

## File Naming Conventions

### Unit Sprites
Pattern: `{unittype}_{faction}.png`
- `infantry_engineer.png`
- `infantry_caravaner.png`
- `tank_engineer.png`
- `tank_caravaner.png`
- `scout_engineer.png`
- `scout_caravaner.png`
- `artillery_engineer.png`
- `artillery_caravaner.png`

Stored in `units/{faction}/` subdirectories.

### Terrain Tiles
Pattern: `{terrain}_v{n}.png`
- `plains_v1.png`, `plains_v2.png`
- `forest_v1.png`, `forest_v2.png`
- `mountain_v1.png`, `mountain_v2.png`
- `city_v1.png`, `city_v2.png`, `city_v3.png`
- `objective_v1.png`

Stored in `tiles/`.

### Unit Icons
Pattern: `{unittype}_icon.png`
- `infantry_icon.png`
- `tank_icon.png`
- `scout_icon.png`
- `artillery_icon.png`

Stored in `icons/`. These are white monochrome silhouettes — faction color is applied at render time via `sprite.tint`.

### Effect Sprites
- `explosion.png` — death marker burst (64x64)
- `damage_font.png` — bitmap font strip for floating damage numbers

Stored in `effects/`.

## Sprite Sizes and Formats

| Asset Type     | Size        | Format          |
|----------------|-------------|-----------------|
| Unit sprites   | 128x128 px  | Transparent PNG |
| Terrain tiles  | ~120x140 px | Transparent PNG |
| Unit icons     | 32x32 px    | Transparent PNG |
| Explosion      | 64x64 px    | Transparent PNG |
| Damage font    | ~132x16 px  | Transparent PNG |

All sprites use transparent backgrounds. No JPEG. All pixel art uses crisp edges with no anti-aliasing.

## Asset Pipeline

### Generation
1. Use prompts in `prompts/` as input to AI image generators
2. Each prompt is self-contained with all context needed for generation
3. Review and iterate on generated output until it matches spec

### Processing
1. Crop/resize to target dimensions
2. Ensure transparent background (remove any generated background)
3. Verify hex tile sprites tile correctly when placed adjacent
4. Save as PNG with alpha channel

### Integration
Assets are loaded in PixiJS via `PIXI.Assets.load()`. The renderer looks for sprites in these directories. If a sprite is not found, the renderer falls back to colored `PIXI.Graphics` shapes (see Placeholder Strategy below).

## Palette Swap via sprite.tint

Unit icons are white (#FFFFFF) monochrome silhouettes. Faction color is applied at render time:

```typescript
sprite.tint = 0xF2C94C; // Engineers — yellow
sprite.tint = 0xD4845A; // Caravaners — copper
```

This means one icon sprite serves both factions. The tint multiplies with the sprite's pixel colors, so white pixels become the tint color, and darker pixels become darker shades of the tint color.

Unit model sprites (128x128) are pre-colored per faction and do NOT use tinting — they have full faction palettes baked in.

## Placeholder Strategy

When sprite assets are not yet available, the renderer uses colored `PIXI.Graphics` fallbacks:

- **Units**: colored hexagon or circle with the unit type's first letter drawn as text
- **Terrain**: solid-filled hex polygons using the Ash & Ember palette colors:
  - Plains: #6A6A58 (ashen olive)
  - Forest: #3A4030 (charred green)
  - Mountain: #505058 (dark iron ore)
  - City: #7A6048 (ember orange-grey)
  - Objective: #C88A20 (molten gold)
  - Fog: #141418 (near-black)
- **Icons**: colored rectangles with text labels
- **Effects**: simple shape animations (expanding circle for explosion, plain text for damage numbers)

The placeholder system ensures the game is playable before any art assets are generated.

## Ash & Ember Color Reference

### Terrain Colors
| Terrain   | Hex       |
|-----------|-----------|
| Plains    | #6A6A58   |
| Forest    | #3A4030   |
| Mountain  | #505058   |
| City      | #7A6048   |
| Objective | #C88A20   |
| Fog       | #141418   |

### Faction Colors
| Faction    | Primary         | Secondary          | Accent           |
|------------|-----------------|--------------------|--------------------|
| Engineers  | #F2C94C yellow  | #828282 steel grey | #1A1A1A black      |
| Caravaners | #D4845A copper  | #4ECDC4 turquoise  | #E8D5B7 sand       |
