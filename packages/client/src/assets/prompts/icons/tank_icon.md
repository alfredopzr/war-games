# Unit Icon — Tank

## Subject
A pixel art silhouette of a tracked armored vehicle viewed from a 3/4 isometric angle. Distinct hull body with a turret on top and a barrel extending forward. Wide tracked base. The shape should read as "heavy armored vehicle" at a glance — treads, hull, turret, gun barrel are all identifiable even at small sizes.

## Style
- Pixel art, 32x32 pixels
- Monochrome white silhouette on transparent background
- No internal detail — pure filled shape
- Must be clearly recognizable at 32x32 and even at 16x16
- The shape should work for both factions since faction identity is applied via sprite.tint at render time

## Faction Neutrality
This icon represents both the Siege Construction Vehicle (Engineers, vertical crane-like) and the War Rig Truck (Caravaners, long horizontal). The silhouette should be a generic armored vehicle — clearly "heavy unit" without being faction-specific. Standard tank/APC archetype.

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
