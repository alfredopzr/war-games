# Effect — Damage Number Font Style

## Subject
Bitmap font characters for floating damage numbers that appear above units during combat. The numbers (0-9) and a minus sign (-) rendered in a bold, impactful style. These float upward from the damaged unit and fade out during the turn replay sequence.

## Characters Needed
- Digits: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
- Minus sign: -
- Each character on its own transparent tile in a horizontal strip (sprite sheet row)

## Style
- Bold, chunky pixel font — thick strokes, no serifs
- Slight 3D effect: dark shadow/outline on bottom-right of each character (1px offset)
- Base color: bright red (#FF3333) for damage numbers
- Shadow/outline: dark red (#880000) or black (#1A1A1A)
- Must be readable against both light terrain and dark fog backgrounds
- Character height: approximately 12-16 pixels tall
- Monospaced — each character occupies the same width cell

## Sprite Sheet Layout
- Single horizontal row: `-0123456789`
- Each character cell: 12x16 pixels (or 16x16 for square cells)
- Total sprite sheet: approximately 132x16 pixels (11 characters x 12px wide) or 176x16 (11 x 16px)
- Transparent background

## Usage
In PixiJS, these will be used as PIXI.BitmapText or manually assembled from the sprite sheet. Damage is displayed as `-{amount} HP` floating upward from the target unit during the turn replay animation. The text spawns at the unit's position, tweens upward by ~30 pixels, and fades to transparent over ~1 second.

## Output
- Transparent PNG sprite sheet
- Bold red pixel font with dark outline/shadow
- Crisp pixel edges, no anti-aliasing
- Each character clearly readable at intended display size
