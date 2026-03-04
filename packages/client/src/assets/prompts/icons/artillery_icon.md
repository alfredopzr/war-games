# Unit Icon — Artillery

## Subject
A pixel art silhouette of a long-range heavy weapon platform. A base/chassis with a long barrel or launcher extending at an upward angle. The barrel is the dominant feature — longer than the base, angled approximately 30-45 degrees upward. Stabilizer legs or supports visible at the base. The shape should read as "long-range, heavy firepower" at a glance.

## Style
- Pixel art, 32x32 pixels
- Monochrome white silhouette on transparent background
- No internal detail — pure filled shape
- Must be clearly recognizable at 32x32 and even at 16x16
- The angled barrel should be the most recognizable feature — it distinguishes artillery from the tank's horizontal barrel
- The shape should work for both factions since faction identity is applied via sprite.tint at render time

## Faction Neutrality
This icon represents both the Construction Crane Cannon (Engineers, tall vertical frame) and the Rocket Truck (Caravaners, angled launcher array). The silhouette should be a generic artillery piece — long angled barrel on a stable base. Not faction-specific.

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
