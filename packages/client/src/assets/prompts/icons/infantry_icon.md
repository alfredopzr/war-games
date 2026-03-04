# Unit Icon — Infantry

## Subject
A pixel art silhouette of a standing soldier figure. Slight forward lean suggesting readiness. A backpack or gear pack visible on the back adds bulk. One arm holds a weapon (rifle shape) pointed slightly upward. Helmet or hard hat on head. Legs in a stable stance, slightly apart. The silhouette should read as "foot soldier with gear" at a glance.

## Style
- Pixel art, 32x32 pixels
- Monochrome white silhouette on transparent background
- No internal detail — pure filled shape
- Must be clearly recognizable at 32x32 and even at 16x16 (when scaled down on minimap)
- The shape should work for both factions (Engineers and Caravaners) since faction identity is applied via sprite.tint at render time

## Faction Neutrality
This icon represents both Combat Engineers (bulky gear packs) and Convoy Riders (slim, scarved). The silhouette should be a middle-ground shape — clearly "infantry" without being faction-specific. Lean toward the generic soldier archetype.

## Tinting
The white silhouette will be colored at runtime:
- Engineers: yellow (#F2C94C)
- Caravaners: copper (#D4845A)
Design the shape so it reads well in both warm tones.

## Output
- Transparent PNG, 32x32 pixels
- White (#FFFFFF) filled silhouette on fully transparent background
- No anti-aliasing — crisp pixel edges
- Centered in the 32x32 frame with 1-2px padding on all sides
