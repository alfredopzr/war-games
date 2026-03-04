# Effect Sprite — Explosion / Death Marker

## Subject
A stylized explosion burst used as a death marker when a unit is destroyed. Not a realistic fireball — a graphic, iconic burst shape. A central bright core with jagged rays or shards radiating outward. Debris particles (small angular chunks) flying outward from the center. Smoke wisps at the edges. The explosion should feel violent but contained — a single frame "boom" that marks where a unit died.

## Usage
This sprite appears at a unit's death position and fades over 3-5 seconds. It needs to read clearly against both light and dark terrain backgrounds. It should not be so large that it obscures adjacent hex tiles.

## Color Palette
- Core: bright molten gold (#C88A20) to white-hot center
- Rays/shards: orange to ember red
- Debris particles: dark grey-black angular chunks
- Smoke: semi-transparent dark grey wisps at outer edges
- Overall warmth — fits the Ash & Ember palette

## Art Style
Stylized, not photorealistic. Sharp geometric rays (not soft gradients). The burst reads as a graphic icon rather than a photograph of an explosion. Flat shaded angular shapes. Consistent with the low-poly, flat-shaded aesthetic of the unit models.

## Output
- Transparent PNG, 64x64 pixels
- Centered in frame
- Semi-transparent edges (smoke wisps fade to transparent)
- Suitable for alpha fade-out animation over 3-5 seconds in PixiJS
