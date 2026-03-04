# Unit Icon — Scout

## Subject
A pixel art silhouette of a small, fast unit. Compact shape suggesting speed and agility — a small vehicle or drone viewed from a 3/4 angle. Thin profile, dynamic pose (angled as if in motion). Could read as either a small drone or a fast bike depending on faction context — the silhouette should be abstract enough to serve both interpretations. Emphasis on "small and fast" versus the larger tank and infantry shapes.

## Style
- Pixel art, 32x32 pixels
- Monochrome white silhouette on transparent background
- No internal detail — pure filled shape
- Must be clearly recognizable at 32x32 and even at 16x16
- Noticeably smaller within the 32x32 frame than tank or infantry icons — the scout should feel small and nimble
- The shape should work for both factions since faction identity is applied via sprite.tint at render time

## Faction Neutrality
This icon represents both the Survey Drone (Engineers, cross-shaped) and the Motorbike (Caravaners, thin horizontal). The silhouette should be a generic fast/light unit — a compact shape that reads as "fast scout" without committing to drone or bike. Small and quick is the key read.

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
