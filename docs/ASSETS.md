# Asset Reference — 3D Models, Props & Prompts

All 3D assets for Chack-Atacc. GLB format, vertex colored, flat shaded, ~300-800 tris. No texture maps.

World tone: **Ash & Ember** — a hyper-expansion construction boom stopped overnight. Unfinished infrastructure everywhere. Dust, scaffolding, exposed steel, incomplete bridges, skeletal skyscrapers.

---

## Shared Style Rules

All models follow these constraints:

- **Format**: `.glb` (binary glTF)
- **Poly count**: 300-800 triangles
- **Shading**: vertex colored — colors baked into mesh vertices, no texture files
- **Style**: Stylized mechanical RTS game assets. Hard edge forms, clean material separation, no outlines. Surface weathering baked into texture — painted dirt, scratches, wear. Flat diffuse lighting only — no shininess, no reflections, no specular highlights, no glossy surfaces. Matte materials throughout. Not illustrated (no ink lines, no painterly shading), not flat/low-poly (no color-block primitives).
- **Scale**: units should be roughly 60-70% of a hex radius tall when placed on the board
- **Orientation**: model faces +Z forward (Three.js convention). Rotation applied at runtime via `mesh.rotation.y`.

---

## Animation Clips (all units)

Every unit model ships with **5 animation clips** embedded in the GLB.

| Clip | Duration | Description |
|------|----------|-------------|
| `idle` | 2-3s loop | Subtle motion while standing still. Breathing, weight shift, engine hum. Looping. |
| `move` | 0.5-1s loop | Forward lean / advance posture. Plays while tweening between hexes. Looping. |
| `attack` | 0.5-0.8s once | Weapon fire, swing, or recoil. Single play, crossfade back to idle. |
| `hit` | 0.3-0.5s once | Flinch, stagger, rock backward. Single play, crossfade back to idle. |
| `death` | 0.8-1.2s once | Collapse, topple, fall. Single play, model removed after. |

---

## Terrain Palette — Ash & Ember

| Terrain | Hex | Description |
|---------|-----|-------------|
| Plains | `#6A6A58` | Ashen olive, scorched |
| Forest | `#3A4030` | Charred green |
| Mountain | `#505058` | Dark iron ore |
| City | `#7A6048` | Ember orange-grey |
| Objective | `#C88A20` | Molten gold |

---

# Factions

6 factions. 4 unit types each. 24 unit models total.

All factions share the same unit classes (infantry, tank, scout, artillery) with identical stats. Faction identity is purely visual — silhouette, palette, material language, and lore.

---

## Engineers

**Identity**: The builders who never stopped. When the collapse hit, Engineers kept pouring concrete and welding steel. They believe civilization restarts when the cranes move again. Every unit is a repurposed piece of construction equipment — bulldozers become tanks, cranes become cannons, survey drones become scouts. They fight to build.

**Visual grammar**: Hard hats, hazard stripes, hydraulic pistons, crane arms, bolted steel panels, welding goggles, reinforced treads. Everything looks like it rolled off a construction site and onto a battlefield. Industrial, heavy, purpose-built.

**Silhouette rule**: **Vertical.** Crane arms reach up. Gear packs stack high. Hard hats add height. At RTS zoom, Engineers are the tallest shapes on the field — vertical stacks of gear and crane arm.

**Palette**:

| Role | Hex | Where it goes |
|------|-----|---------------|
| Primary | `#F2C94C` | Hard hats, crane booms, bulldozer blades, hazard stripes, rotor arms. The dominant color on every unit — if it's yellow, it's an Engineer. |
| Secondary | `#828282` | Steel frames, tracked bases, hydraulic pistons, cannon barrels, hull panels. The structural skeleton underneath the yellow. |
| Accent | `#1A1A1A` | Track rubber, exhaust pipes, deep shadows, boot soles, viewport slits. Used sparingly for grounding and contrast. |

**Design constraints**:
- Every unit must have at least one **hazard stripe** detail (yellow-black diagonal bands)
- Every unit must have visible **bolted steel** or **welded plates** — these are construction machines
- No cloth, no fabric, no organic materials. Metal, rubber, concrete, hydraulic fluid.
- Paint is chipped and dusty but intentional — these machines were originally painted yellow by their manufacturer
- Hydraulic lines and pistons should be visible on vehicles — the engineering is exposed, not hidden

---

### Infantry — Combat Engineers

**File**: `infantry_engineer.glb`

**Subject**: Front view only. A lean, sun-weathered construction worker turned soldier standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Hard hat — yellow, dented at the crown, concrete dust caked into the brim, hazard stripe band around the base. Steel-frame tool pack mounted on the back — flat rectangular frame welded from angle iron, carrying tools strapped to it: a wrench handle worn smooth at the grip, a measuring rod, a coil of cable. The pack rides high on the back but is narrow — industrial, not cartoonish. Welding goggles pushed up on forehead, lenses scratched, rubber seal cracked from sun exposure. Utility belt cinched at the waist — tool pouches and cutting tools, rust-stained around the rivets. Heavy-duty work trousers, knees worn through. Steel-toe boots caked with dried mud, the steel toe scuffed bare. Right hand gripping a pneumatic nail gun repurposed as a weapon — arm extended straight out to the side, connected to the pack compressor by a rubber hose, fittings oil-darkened from use. Hard edge forms, clean material separation between skin, fabric, metal, rubber. Surface wear baked in.

**Visual markers**:
- Hard hat — yellow, hazard stripe band, dented and dusty
- Steel-frame tool pack on back — narrow, industrial, tools strapped to the frame
- Welding goggles pushed up on forehead
- Hazard stripe details on shoulders and pack straps
- Pneumatic nail gun with trailing rubber hose
- Hard edge forms — clean material separation, each surface reads as a distinct zone

**Silhouette**: Vertical. Hard hat and tool pack add height above a lean upright body. Tall narrow shape — taller than wide, reads as a standing worker with a laden back.

**Colors**: Primary yellow `#F2C94C` hard hat, hazard stripes, pack highlights. Secondary steel `#828282` tools, backpack frame, nail gun body. Accent black `#1A1A1A` boots, goggles, hose, straps.

**Animations**:
- `idle`: weight shifts side to side, backpack sways. Breathing motion in chest.
- `move`: forward lean, arms pump slightly, gear pack bounces. Hose trails.
- `attack`: raises nail gun, fires forward. Recoil snaps wrist back. One arm extends.
- `hit`: flinches backward, stumbles half-step, catches balance.
- `death`: drops nail gun, knees buckle, falls forward onto gear pack.

---

### Infantry (Upgraded) — Heavy Riveter

**File**: `infantry2_engineer.glb`

**Subject**: Front view only. A heavy construction soldier standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Welded steel plate armor over dirty coveralls — chest plate bolted together from thick steel panels, shoulder pauldrons made from cut I-beam sections, thigh guards from flattened pipe. Hydraulic exo-frame on both arms — exposed pistons and steel rods running from shoulder to wrist, bolted at the joints. Welding mask flipped down over the face — dark rectangular viewport, mask surface scratched and spatter-marked. Yellow hazard stripes painted across the chest plate and shoulder pauldrons, paint chipped at the edges. Right hand gripping a portable rivet cannon — heavy two-handed weapon with a belt feed running to an ammo box on the hip, steel barrel with ventilation slots. Steel-toe boots reinforced with welded toe caps. Hard edge forms, clean material separation between steel plate, fabric, hydraulic components. Surface wear baked in.

**Visual markers**:
- Welded steel plate armor — chest plate, I-beam shoulder pauldrons, pipe thigh guards
- Hydraulic exo-frame on both arms — exposed pistons and rods
- Welding mask down — dark viewport, spatter-marked
- Belt-fed rivet cannon — heavy, two-handed
- Yellow hazard stripes on armor, chipped paint

**Silhouette**: Wide and heavy. Exo-frame arms extend the width. Plate armor bulks up the torso. Welding mask adds height. At RTS zoom reads as a stocky armored construction worker — wider and heavier than base infantry.

**Colors**: Primary yellow `#F2C94C` hazard stripes on armor, shoulder markings. Secondary steel `#828282` plate armor, exo-frame, rivet cannon, welding mask. Accent black `#1A1A1A` hydraulic hoses, ammo belt, boot soles, welding mask viewport.

**Animations**:
- `idle`: exo-frame hisses with hydraulic pressure. Weight shifts. Rivet cannon held steady.
- `move`: heavy stomping stride, exo-frame pistons cycling. Slower than base infantry.
- `attack`: raises rivet cannon, fires burst of rivets forward. Heavy recoil absorbed by exo-frame.
- `hit`: plate armor sparks on impact. Staggers but holds ground.
- `death`: exo-frame locks up, soldier topples forward like a felled tree. Crashes flat.

---

### Tank — Siege Construction Vehicle

**File**: `tank_engineer.glb`

**Subject**: A heavy construction machine turned assault platform. Tracked excavator chassis with a massive front bulldozer blade — welded reinforcement ribs across its face, blade edge gouged and dented from impact, rust bleeding from the weld seams. A crane arm folds along the top of the hull, repurposed as a weapon mount with a grapple/hammer at the tip — paint worn to bare steel along the upper edge from years of friction. Reinforced steel panels bolted over the hull with visible rivets, rust-spotted at the bolt heads. Exposed hydraulic pistons along the sides — oil-darkened at the seals, grime packed into the cylinder grooves. Armored operator cabin — small, boxy, welded plates with a slit viewport, viewport glass scratched and smeared. Hazard stripes on blade edges and cabin corners, partially chipped and faded.

**Visual markers**:
- Bulldozer blade — large, flat, angled forward, reinforcement ribs, hazard stripes on edges
- Crane arm folded along top — weapon/grapple at tip
- Bolted steel panels with visible rivets
- Exposed hydraulic pistons along sides
- Tracked chassis — industrial treads, heavy and wide
- Slit viewport on armored cabin

**Silhouette**: Vertical. Crane arm and front blade give it height. Tall, front-heavy shape with vertical protrusion on top.

**Colors**: Primary yellow `#F2C94C` bulldozer blade, crane arm, hazard stripes, cabin highlights. Secondary steel `#828282` hull panels, tracked base, hydraulic pistons, rivets. Accent black `#1A1A1A` track rubber, exhaust pipes, viewport slit.

**Animations**:
- `idle`: engine vibration — hull bobs ±1px. Hydraulics hiss (subtle piston shift).
- `move`: hull tilts forward, blade rises. Tracks roll (hull bounce).
- `attack`: crane arm swings forward, blade slams down. Heavy recoil on hull.
- `hit`: hull rocks backward, blade dips.
- `death`: hull lists to one side, crane arm drops limply, settles into ground.

---

### Scout — Survey Drone

**File**: `scout_engineer.glb`

**Subject**: A construction site survey drone repurposed for battlefield recon. Four rotor arms extending from a flat rectangular central body in a cross shape — about 20cm across, low-profile, industrial. Antenna array on top — thin rods and a small dish. Sensor pod hangs beneath (camera/lidar). Exposed circuit boards on the body. Blinking indicator lights. Yellow hazard markings on rotor arms. Small, nimble, utilitarian — scratched plastic casing, dust on the lens, one rotor arm slightly bent but functional.

**Visual markers**:
- Quad-rotor layout — four arms with rotor discs at tips
- Antenna array — thin rods and small dish on top
- Sensor pod — small cylinder hanging below
- Cross-shaped silhouette from above
- Flat rectangular central body — low-profile, industrial, no curves
- Hazard markings on rotor arms

**Silhouette**: Vertical (cross shape). Antenna spikes extend upward from the body. At small sizes, reads as a small cross with a dot on top.

**Colors**: Primary yellow `#F2C94C` rotor arms, body panels, hazard markings. Secondary steel `#828282` antenna array, sensor pod, structural frame. Accent black `#1A1A1A` rotors, circuit boards, deep shadows.

**Animations**:
- `idle`: hover bob — Y oscillates ±3px at ~1Hz. Slight tilt/wobble. Rotors spin (blur disc or vertex rotation).
- `move`: tilts forward ~15°, bob increases. Speed feeling.
- `attack`: sensor pod flashes (vertex color pulse), tilts toward target, slight recoil.
- `hit`: wobbles violently, one arm dips, recovers.
- `death`: rotors stall, spirals down, crashes flat. Sparks (vertex flash).

---

### Scout (Upgraded) — Giant Mole Rat

**File**: `scout2_engineer.glb`

**Subject**: A giant naked mole rat the size of a pony, ridden by a construction scout. Wrinkled pink-grey skin, no fur, massive protruding front incisors, tiny squinting eyes, stubby ears. Thick muscular body built for burrowing — wide flat claws on all four feet, barrel-shaped torso. Simple leather saddle strapped behind the shoulders, rope reins looped behind the incisors. Rider wears a yellow hard hat, welding goggles pushed up, utility belt, heavy work trousers, steel-toe boots. Rider sits upright on the saddle. No armor on the animal — wild tamed. Hard edge forms, clean material separation between skin, leather, metal. Surface wear baked in.

**Visual markers**:
- Giant naked mole rat — wrinkled pink-grey skin, no fur, massive incisors
- Wide flat digging claws on all four feet
- Tiny squinting eyes, stubby ears
- Simple leather saddle and rope reins
- Rider in hard hat and work gear

**Silhouette**: Low and wide. Barrel-shaped body close to the ground, massive head with protruding teeth. Rider adds vertical element above a horizontal beast.

**Colors**: Primary pink-grey skin on the mole rat. Secondary yellow `#F2C94C` hard hat, hazard stripe on saddle straps. Accent steel `#828282` tools on belt, boot caps, goggle frames.

**Animations**:
- `idle`: mole rat sniffs the air, head bobs side to side. Rider shifts weight.
- `move`: low scurrying gallop, belly close to ground, claws dig in. Rider leans forward.
- `attack`: mole rat lunges forward with open jaws. Rider braces.
- `hit`: mole rat flinches sideways, stumbles. Rider grabs saddle.
- `death`: mole rat collapses forward, slides on belly. Rider thrown.

---

### Artillery — Construction Crane Cannon

**File**: `artillery_engineer.glb`

**Subject**: A tower crane base converted into long-range artillery. Rotating turret platform on a tracked base. The crane boom has been reinforced and fitted with a long-barreled cannon — the boom arm serves as the barrel support structure, extending upward and forward, paint worn to bare metal at the pivot joints from repeated rotation. Hydraulic stabilizer legs deploy outward at angles for recoil absorption — piston rods oil-smeared, leg bases ground-scarred. Armored operator cabin — small, boxy, welded steel plates with a slit viewport, weld beads rough and unpainted. Yellow hazard markings on everything, sun-bleached to a chalky pale yellow on the upper surfaces, chipped at edges. The tallest unit in the Engineers roster.

**Visual markers**:
- Crane base — rotating turret platform on tracks
- Long boom arm — cannon barrel mount, extends upward and forward
- Hydraulic stabilizer legs — deployed outward at angles
- Armored operator cabin — small, boxy, welded, slit viewport
- Hazard stripes on stabilizer legs and boom
- Tallest vertical frame of all Engineer units

**Silhouette**: Vertical. Crane boom / cannon barrel extends high above tracked base. Tallest unit on the field. Reads as an inverted "L" or "T" shape.

**Colors**: Primary yellow `#F2C94C` crane boom, cabin panels, hazard stripes on stabilizers. Secondary steel `#828282` tracked base, cannon barrel, hydraulic cylinders. Accent black `#1A1A1A` tracks, viewport slit, deep mechanical shadows.

**Animations**:
- `idle`: barrel sways slightly. Stabilizers creak (subtle shift). Cabin hatch vibrates.
- `move`: barrel lowers to stowed position, stabilizers retract. Chassis rolls.
- `attack`: barrel elevates to firing angle, fires. Massive recoil — whole frame rocks backward. Stabilizers absorb shock.
- `hit`: frame shudders, stabilizer slips, barrel wobbles.
- `death`: barrel drops limply, stabilizer leg snaps, frame tips and collapses sideways.

---

## Caravaners

**Identity**: Mobile convoy culture. Caravaners never settled — they move. When the highways froze mid-construction, Caravaners turned the unfinished infrastructure into trade routes. Half-built overpasses become waypoints. Abandoned rail corridors become convoy lanes. Every unit is a modified road vehicle or rider — trucks become tanks, motorbikes become scouts, cargo haulers become artillery platforms. They fight to keep moving.

**Visual grammar**: Welded scrap armor over road vehicles, cloth banners and tarps, exhaust stacks, oversized tires, saddlebags, goggles, trailing scarves. Everything looks like it was armored in a truck stop parking lot. Road-worn, improvised, mobile.

**Silhouette rule**: **Horizontal.** Trucks stretch wide. Bikes lean long. Scarves trail. At RTS zoom, Caravaners are the widest, lowest shapes on the field — the opposite of Engineers' vertical stack.

**Palette**:

| Role | Hex | Where it goes |
|------|-----|---------------|
| Primary | `#D4845A` | Welded armor plates, leather jackets, bike frames, truck cabs, bandolier pouches. The warm copper base of every unit — sun-baked metal and road dust. |
| Secondary | `#4ECDC4` | Scarves, tarps, painted convoy markings, goggle lenses, cloth banners. The cool contrast that says "we're Caravaners." Fabric and paint, never metal. |
| Accent | `#E8D5B7` | Dust-covered surfaces, sand, tire sidewalls, base clothing, rope, saddlebags. The neutral filler — road dust, desert sun, worn linen. |

**Design constraints**:
- Every unit must have at least one piece of **turquoise fabric** — a scarf, a tarp, a banner, painted markings. This is the faction identifier.
- Every vehicle has **welded scrap armor** — mismatched metals, visible weld beads, bolts. Not factory-made, not clean.
- Wheels, not tracks. Tires, not treads. Caravaners are road people — they roll, they don't crawl.
- Dust on everything. Tire sidewalls are sand-colored. Armor is sun-faded. Nothing is freshly painted.
- At least one **exhaust stack** or **exhaust pipe** on every vehicle — these machines burn fuel hard and fast.

---

### Infantry — Convoy Riders

**File**: `infantry_caravaner.glb`

**Subject**: Front view only. A nomadic convoy rider standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Flowing scarves and bandanas wrapped around face and neck — turquoise and copper fabric. Light scrap armor: thin welded metal plates over a leather jacket, not bulky. Bandoliers of ammunition slung across chest in an X pattern. Lean, road-worn fighter built for speed and endurance. Goggles on forehead. Slimmer, lower profile than the Engineer infantry. Right hand gripping a bolt-action rifle by the grip — arm extended straight out to the side, barrel pointing outward.

**Visual markers**:
- Scarves and face wraps — turquoise and copper fabric, trailing
- Light scrap armor — thin welded plates, not heavy
- Bandoliers across the chest in an X
- Goggles on forehead or hanging around neck
- Lean, road-worn build — slimmer than Engineer infantry

**Silhouette**: Horizontal. Scarves extend sideways, bandoliers stretch across body width. Wider, lower shape — spread out rather than stacked up.

**Colors**: Primary copper `#D4845A` armor plates, leather jacket, bandolier pouches. Secondary turquoise `#4ECDC4` scarves, face wraps, painted markings. Accent sand `#E8D5B7` base clothing, dust-covered surfaces, belt.

**Animations**:
- `idle`: scarf sways in wind, slight hip shift. Relaxed but alert.
- `move`: forward lean, one hand steadies bandolier, quick stride.
- `attack`: sidearm draw and fire, or machete slash forward.
- `hit`: stumbles sideways, catches with one arm.
- `death`: spins, drops weapon, collapses to one knee then flat.

---

### Infantry (Upgraded) — Convoy Gunner

**File**: `infantry2_caravaner.glb`

**Subject**: Front view only. A heavy convoy gunner standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Heavier welded scrap plate armor than base infantry — thick copper-brown steel plates bolted over chest, shoulders, and thighs over a leather jacket. Bandoliers of ammunition across the chest in an X, extra ammo belt draped over the left shoulder feeding down to the weapon. Goggles on forehead, turquoise scarf wrapped around the neck and lower face. Fuel canister strapped to the back — dented steel cylinder with a brass valve cap. Right hand gripping a belt-fed machine gun ripped from a truck mount — arm extended straight out to the side, heavy barrel, bipod folded under, ammo belt trailing from the receiver. Heavy copper-brown boots, knee guards made from flattened scrap metal. Hard edge forms, clean material separation between metal plate, leather, fabric, ammunition. Surface wear baked in.

**Visual markers**:
- Heavy welded scrap plate armor — chest, shoulders, thighs
- Belt-fed machine gun — heavy, ripped from a truck mount, bipod folded
- Extra ammo belt draped over shoulder, bandoliers across chest
- Fuel canister on back — dented steel cylinder
- Turquoise scarf, goggles on forehead

**Silhouette**: Wide and heavy. Plate armor and ammo belts bulk up the torso. Machine gun extends one side. At RTS zoom reads as a wider, heavier version of the base caravaner.

**Colors**: Primary copper `#D4845A` armor plates, machine gun body, boots, fuel canister. Secondary turquoise `#4ECDC4` scarf, painted markings on armor. Accent sand `#E8D5B7` ammo belt, bandolier pouches, leather jacket underneath.

**Animations**:
- `idle`: shifts weight, adjusts ammo belt on shoulder. Machine gun barrel dips and rises.
- `move`: heavy forward lean, machine gun at hip. Slower than base infantry. Ammo belt sways.
- `attack`: plants feet, raises machine gun, fires sustained burst. Brass casings eject. Heavy recoil.
- `hit`: staggers back, armor plate sparks. Catches balance with wide stance.
- `death`: drops machine gun, sinks to knees, falls sideways. Ammo belt spills.

---

### Tank — War Rig Truck

**File**: `tank_caravaner.glb`

**Subject**: An armored semi-truck converted into a mobile war platform. Large rotating gun turret mounted on a raised steel platform on the flatbed — the turret sits higher than the truck cabin, with a long barrel pointing forward. Dual exhaust stacks rising from behind the cab. Welded scrap armor plates covering the cab and sides — mismatched metals in warm copper-orange tones, bolted and riveted together. Wide-profile all-terrain tires. Turquoise cloth banners tied to exhaust stacks.

**Visual markers**:
- Gun turret on a raised platform — sits above the cabin roofline, long barrel, tallest point on the truck
- Armored semi-truck — long, horizontal, road-dominant
- Dual exhaust stacks — twin vertical pipes behind the cab
- Patchwork welded armor — warm copper-orange metals, visible welds and rivets
- Wide-profile all-terrain tires
- Turquoise cloth banners tied to exhaust stacks

**Silhouette**: Horizontal. Long truck body stretches wide. Gun turret breaks the roofline. The widest vehicle on the field.

**Colors**: Primary warm copper-orange `#D4845A` — all welded armor plates, cab body, turret housing. This is the dominant color. Secondary turquoise `#4ECDC4` banners, painted convoy markings, accent stripes. Accent sand `#E8D5B7` dust-covered surfaces, tire sidewalls, lighter armor patches.

**Animations**:
- `idle`: engine rumble — cab vibrates, exhaust stacks shimmer. Banners sway.
- `move`: cab dips forward, suspension compresses. Wheels roll (hull bounce).
- `attack`: flatbed turret recoils, cab rocks back.
- `hit`: whole rig rocks sideways, armor plates rattle.
- `death`: rig tips to one side, exhaust stack snaps, settles on flat tires.

---

### Scout — Motorbike

**File**: `scout_caravaner.glb`

**Subject**: A dirt bike / scrambler motorcycle ridden by a biker scout. Copper-brown bike frame with exposed engine block. Rider wears a biker helmet with goggles strapped over it, a long sand-colored duster coat over light copper scrap armor, turquoise scarf trailing from the neck. Sand-colored cargo pants tucked into copper-brown boots. Knobby off-road tires, welded scrap fender. High exhaust pipe along the side. Small saddlebags on the rear. Fast, light — speed is the defense.

**Visual markers**:
- Biker helmet with goggles strapped over it
- Long sand-colored duster coat flaring behind the rider
- Turquoise scarf trailing from neck — visible fabric
- Light copper scrap armor under the coat
- Dirt bike frame — copper-brown metal, exposed engine block, high exhaust pipe
- Turquoise stripe painted on fuel tank

**Silhouette**: Horizontal. Bike and rider create a long, low, narrow shape. Duster coat flares behind. Thin horizontal line with small bump (rider).

**Colors**: Copper #D4845A bike frame, engine block, fender, boots, scrap armor. Turquoise #4ECDC4 scarf, fuel tank stripe, goggle lenses. Sand #E8D5B7 duster coat, cargo pants, saddlebags, tire sidewalls.

**Animations**:
- `idle`: engine vibration, rider shifts weight. Scarf sways.
- `move`: rider leans forward hard, front wheel lifts slightly. Scarf trails.
- `attack`: rider draws sidearm and fires sideways, bike swerves slightly.
- `hit`: bike jolts, rider grips handlebars, swerves to recover.
- `death`: bike tips sideways, rider thrown, bike slides on ground.

---

### Scout (Upgraded) — War Ostrich

**File**: `scout2_caravaner.glb`

**Subject**: A wild tamed war ostrich ridden by a convoy scout. Large flightless bird with thick powerful legs, long neck, small fierce head. Dense plumage of dusty brown-grey feathers covering the entire body — big fluffy tail feathers, wing feathers spread wide, thick feathered thighs. Sun-bleached feather tips. No armor on the bird. Rope bridle around the beak, simple leather saddle nestled into the feathers on the back, stirrups hanging. Rider wears a biker helmet with goggles strapped over it, a long sand-colored duster coat over light copper scrap armor, turquoise scarf trailing from the neck. Sand-colored cargo pants tucked into copper-brown boots. Hard edge forms, clean material separation between feathers, leather, fabric, metal. Surface wear baked in.

**Visual markers**:
- Giant ostrich — dense dusty brown-grey plumage, powerful thick legs
- Rope bridle and simple leather saddle
- Rider in biker helmet, duster coat, turquoise scarf
- No armor on the bird — wild tamed

**Silhouette**: Tall and narrow. Long neck rises above rider's head. Powerful legs underneath. At RTS zoom reads as a tall vertical shape with a distinctive bird head at the top.

**Colors**: Primary dusty brown-grey feathers on the ostrich. Secondary copper `#D4845A` scrap armor, boots, saddle leather. Accent turquoise `#4ECDC4` scarf, goggle lenses.

**Animations**:
- `idle`: ostrich shifts weight between legs, head bobs, feathers ruffle. Rider adjusts reins.
- `move`: long-stride gallop, neck pumps forward and back. Rider leans into the motion, scarf trails.
- `attack`: rider draws sidearm and fires sideways. Ostrich kicks forward with one leg.
- `hit`: ostrich stumbles, wings flare out for balance. Rider grabs saddle.
- `death`: ostrich crumples forward, wings spread on ground. Rider thrown clear.

---

### Artillery — Rocket Truck

**File**: `artillery_caravaner.glb`

**Subject**: A medium cargo truck with a rocket launcher array mounted on the flatbed. Warm copper-orange armored cab with welded scrap plates — mismatched copper-toned metals bolted together. Truck bed carries a tilted rack of rocket tubes — multiple cylindrical barrels in a grid, angled upward at ~45°. Heavy all-terrain wheels. Turquoise cloth tarp partially drapes over the rocket rack. Exhaust pipe on side of cab. Copper-orange is the dominant color across the entire vehicle.

**Visual markers**:
- Armored truck cab — warm copper-orange welded scrap plates
- Rocket rack — grid of cylindrical tubes angled upward at 45°, copper housings
- Large turquoise tarp draped over the rocket rack — visible fabric
- Wide-profile all-terrain tires with sand-colored sidewalls
- Side exhaust pipe
- Welded armor all in warm copper-orange tones, not grey

**Silhouette**: Horizontal. Truck body stretches wide, angled rocket rack extends the profile further. Wide shape with angled protrusion. Lower and wider than Engineer Crane Cannon.

**Colors**: Copper-orange #D4845A truck cab, welded armor plates, rocket tube housings — dominant color. Turquoise #4ECDC4 tarp over rack, convoy markings, painted stripe on cab. Sand #E8D5B7 truck bed floor, tire sidewalls, dust patches.

**Animations**:
- `idle`: cab vibrates (engine). Tarp flutters at edges. Exhaust pipe heat shimmer (vertex wobble).
- `move`: cab dips forward, tarp flaps back. Wheels roll (chassis bounces).
- `attack`: tarp pulls back, rocket rack tilts up to firing angle, fires salvo. Cab rocks from recoil. Smoke from tubes.
- `hit`: truck rocks sideways, a rocket tube dents (vertex shift).
- `death`: rocket rack collapses, truck tips, one wheel pops off.

---

## Los Pistoleros

**Identity**: Modern cartel militia who seized their territory when the collapse hit — and held it. Not revolutionaries. Not bandits. These are organized, disciplined gunfighters who run checkpoints, collect tolls, and control every road in their zone. Former security contractors, ex-police, street crews. They armed up, blacked out their trucks, and stenciled neon green on every wall that marks their ground. They don't wear costumes. They wear plate carriers and balaclavas. You don't see their faces. You see the green mark on the wall. You turn around.

**Visual grammar**: Dark balaclavas or wrapped face coverings, civilian plate carriers, tactical pants, black boots, dual revolvers holstered low, gold chains at the collar. Vehicles: blacked-out 4x4s, open-frame buggies with armor plate welded on, lifted SUVs with weapons mounted through the roof. Neon green spray paint as territorial marking — stenciled on vehicle panels, sprayed on walls, worn as tape on wrists or gear. Everything is dark, fast, and deliberate. No costumes, no flags.

**Silhouette rule**: **Wide and planted.** Stances are broad. Vehicles are wide and aggressive — lifted, armored, commanding. At RTS zoom, Pistoleros are dark low shapes with neon green accents that punch out from the charcoal.

**Palette**:

| Role | Hex | Where it goes |
|------|-----|---------------|
| Primary | `#3D3D3D` | Plate carriers, balaclavas, boot leather, armor plate, vehicle chassis, tactical gear. The dominant tone — dark charcoal. Everything reads dark at a distance. |
| Secondary | `#39FF14` | Neon green — territorial spray paint on vehicle panels, tape on gear, stenciled markings. The signal color. When you see the green, you know whose road this is. Used as detail lines and marks, never as fill. |
| Accent | `#F0EDE0` | Bone — sandbags, rope, bare metal scratches, dust on surfaces, light interior trim. The neutral that keeps the dark palette readable. |

**Design constraints**:
- Every unit must have at least one **neon green mark** visible at zoom — a spray stencil on a vehicle panel, a strip of tape on gear, a painted marking. This is the faction signal color.
- Every unit must feel **planted and threatening** — wide stances, fortified vehicles, forward-leaning aggression. Pistoleros own this ground.
- **No eagles, no sombreros, no revolutionary iconography.** This is the modern cartel. Faces are covered. Identity is the green mark.
- Dark tactical materials — plate carriers, ballistic fabric, rubber, raw steel. Not leather and linen.
- No turquoise, no yellow, no warm tones. Pistolero palette is cold and dark — charcoal, neon green, bone. The green should feel electric against the dark.

---

### Infantry — Pistoleros

**File**: `infantry_pistolero.glb`

**Subject**: Front view only. A lean cartel gunfighter standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Face visible. Light brown skin. Black hair — grade 2 buzz cut, tight to the skull, with a sharp natural widow's peak at the center forehead hairline. Clean short beard, well-kept, following the jaw line precisely. Modern wraparound sunglasses — dark lens, thin dark frame, sitting close to the face. Black ink tattoos covering the entire right forearm — dense sleeve of geometric and figurative designs, sharp edges, no color, solid black against the light brown skin, visible where the sleeve is pushed up. White long-sleeve cotton t-shirt, fitted, right sleeve pushed to mid-forearm exposing the tattoo, left sleeve down to the wrist. Clean but lived-in — slight pull at the shoulders from the vest straps. Charcoal bulletproof vest worn over the shirt — soft-shell carrier, front panel flat and unadorned, shoulder straps adjusted tight, side straps cinched. A neon green stripe of tape on the left shoulder strap — the only color on the body. A clutch bag strapped across the back — compact rectangular bag on a single diagonal strap running from left shoulder to right hip, charcoal nylon, clasp worn. Dark tactical cargo pants tucked into black lace-up boots, boot leather creased at the ankle from road miles. A gold chain at the collar — just visible above the vest, thin rope chain. A large gold watch on the left wrist — thick round case, large dial, bracelet links, worn over the left sleeve cuff. A fixed-blade knife on the right hip — short blade, dark handle, sheath worn smooth. Right hand gripping a short-stroke gas-operated carbine by the handguard — arm extended straight out to the side. 16-inch barrel, collapsible stock fully extended, 30-round polymer magazine, flip-up iron sights, flat dark earth finish scratched at the hand stop and stock hinge. Sling looped over the right shoulder. Hard edge forms, clean material separation between skin, fabric, nylon, metal. Surface wear baked in — creased boots, scuffed vest, dust on fabric. No outlines.

**Visual markers**:
- Grade 2 buzz cut, widow's peak hairline, black hair
- Light brown skin tone
- Clean short beard
- Modern wraparound sunglasses
- Dense black ink tattoo sleeve on right forearm — geometric and figurative, solid black
- White long-sleeve t-shirt, right sleeve pushed up exposing tattoo
- Charcoal bulletproof vest — soft-shell, flat front, shoulder straps tight
- Neon green tape strip on left shoulder strap
- Clutch bag on diagonal strap across back
- Gold chain at collar, large gold watch on left wrist
- Fixed-blade knife on right hip — short blade, dark sheath
- Short-stroke gas carbine at low ready — collapsible stock, 30-round mag, flat dark earth finish
- Sling over right shoulder

**Silhouette**: Wide and planted. Vest fills the torso, wide stance anchors the base. White shirt visible at collar and the tattooed right forearm — the two light elements against an otherwise dark figure. Reads as a composed, dangerous civilian.

**Colors**: Primary charcoal `#3D3D3D` bulletproof vest, cargo pants, knife sheath, boot leather, sunglasses frame. Secondary neon green `#39FF14` tape strip on left shoulder strap. Accent bone `#F0EDE0` white t-shirt at collar and forearms, gold chain, gold watch.

**Animations**:
- `idle`: weight shifts heel to heel. Tattooed right hand hangs loose near the knife. Head turns slowly — watching.
- `move`: steady deliberate walk, carbine at low ready, boots strike hard.
- `attack`: raises carbine to shoulder, fires a controlled burst. Recoil pushes stock back into shoulder. Bolt cycles.
- `hit`: staggers back one step, absorbs it, straightens.
- `death`: drops carbine, sinks to one knee, falls forward flat.

---

### Infantry (Upgraded) — El Químico

**File**: `infantry2_pistolero.glb`

**Subject**: Front view only. A cartel chemist standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Thin build, not muscular. Thick-framed glasses — dark rectangular frames, cracked at the bridge, taped with a small strip of white tape. Clean-shaven with a thin mustache. Black hair slicked straight back, neat, parted with a comb. White dress shirt — once clean, now yellowed at the collar and cuffs, sleeves rolled to the elbow exposing forearms with chemical burn scars — pink-red discolored patches on light brown skin. Leather shoulder holster over the shirt on the left side — compact pistol in the holster, an afterthought. Stained lab coat worn open over everything — off-white turned yellow-brown from chemical exposure, four front pockets stuffed with small glass vials, two vials clipped to the left lapel with binder clips. Nitrile gloves on both hands — purple, slightly torn at the fingertips, hands underneath permanently discolored grey-yellow. Two gold rings — one on each hand, thick bands, cartel money. Dark trousers, black leather shoes scuffed at the toes. Right hand gripping a handheld dispersal nozzle — arm extended straight out to the side, chrome spray nozzle connected by a rubber hose to a pressurized steel tank on the back. The tank is a modified fire extinguisher — dented steel cylinder, brass pressure gauge on top, neon green spray paint marking on the tank body. Hard edge forms, clean material separation between fabric, rubber, glass, steel. Surface wear baked in — chemical stains, yellowed fabric, scuffed shoes.

**Visual markers**:
- Thick-framed glasses — cracked, taped at the bridge
- Stained lab coat worn open — vials clipped to lapel, stuffed pockets
- White dress shirt yellowed, sleeves rolled, chemical burn scars on forearms
- Pressurized tank on back — modified fire extinguisher, neon green spray mark
- Handheld dispersal nozzle with rubber hose
- Purple nitrile gloves, gold rings, shoulder holster

**Silhouette**: Narrow and vertical. Lab coat hangs loose, tank on back adds bulk behind. Not a soldier — reads as a civilian specialist. At RTS zoom the lab coat silhouette is unmistakable.

**Colors**: Primary charcoal `#3D3D3D` trousers, shoes, shoulder holster. Secondary neon green `#39FF14` spray mark on tank, vial liquid color. Accent yellowed white lab coat and shirt, gold rings, brass gauge.

**Animations**:
- `idle`: adjusts glasses with one gloved hand. Completely still otherwise. Calm.
- `move`: measured walk, nozzle at side. Lab coat sways. No urgency.
- `attack`: raises nozzle, sprays forward. Green mist. No recoil — just pressure release.
- `hit`: stumbles, glasses slip. Catches them. Tank hisses from a leak.
- `death`: drops nozzle, tank ruptures — green cloud. Sinks to knees, falls sideways.

---

### Tank — Blindado

**File**: `tank_pistolero.glb`

**Subject**: A large American crew-cab pickup truck — wide body, long wheelbase, aggressive front end with a tall flat grille and quad headlights. The cab and bed sides are fully plated: heavy flat steel armor panels bolted directly over the doors and rear quarters, panel edges rough-cut and unfinished, weld beads raw, bolts large and uneven. The windshield is covered — a steel plate with a narrow horizontal vision slit at driver eye level, the driver invisible from outside. The roof of the cab is plated solid. The truck bed is open at the top — a circular steel ring mount welded into the forward section of the bed, and on it a manned .50 caliber heavy machine gun on a full-rotation pintle: long heavy barrel, perforated heat shroud, ammunition box mounted on the left side of the receiver, a belt of linked rounds feeding into the breech. A gunner stands behind the weapon — dark balaclava, dark vest, both hands on the spade grips, scanning. Neon green spray stencil on the driver-side armor plate — territorial marking, uneven edges. Wide-profile mud-terrain tires on all four corners, sidewalls dusty. Dual exhaust tips at the rear, soot-darkened. 
**Visual markers**:
- Large crew-cab pickup body — wide, long, aggressive grille with quad headlights
- Full steel armor plating over doors and rear quarters — raw edges, large bolts
- Plated windshield with narrow horizontal vision slit — driver hidden
- Plated cab roof — solid
- Open truck bed with .50 cal on full-rotation ring mount
- Visible gunner at the .50 cal — balaclava, vest, hands on spade grips
- Ammunition belt feeding into receiver, ammo box on left side
- Neon green spray stencil on driver-side armor plate
- Wide-profile mud-terrain tires, dual exhaust at rear

**Silhouette**: Wide and dominant. Plated cab sits tall and sealed. Open bed with the gunner and .50 cal barrel extending forward above the roofline is the tallest point. At RTS zoom: a wide armored rectangle with a gun barrel and standing figure breaking the top edge.

**Colors**: Primary charcoal `#3D3D3D` armor plates, cab body, gun barrel, tires, gunner gear. Secondary neon green `#39FF14` spray stencil on driver-side armor plate. Accent bone `#F0EDE0` bare metal scratches at plate edges, ammunition belt casings, headlight bezels.

**Animations**:
- `idle`: engine idles — whole truck vibrates low. Gunner shifts weight, traverses the .50 cal slowly left-right, scanning.
- `move`: truck surges forward, suspension loads, armor plates rattle slightly. Gunner braces on the grips.
- `attack`: gunner snaps the .50 cal to target and fires a long burst — barrel climbs slightly from recoil, whole truck rocks. Brass casings arc out from the right side of the receiver.
- `hit`: truck lurches hard to one side, gunner grips the mount to stay upright.
- `death`: rear tire blows, truck slides and lists, gunner is thrown sideways. .50 cal swings loose on the ring mount.

---

### Scout — Halcón

**File**: `scout_pistolero.glb`

**Subject**: A fast scout cruising in a two-seat side-by-side UTV — a narrow dune buggy with an open roll cage, the kind used for desert and dune running. The UTV: slim tubular roll cage in a rectangular arch over two bucket seats, no doors, no windshield. Low-profile body panels on the front and sides — charcoal dark, dust-caked at the lower edges, neon green territorial spray marking stenciled across the hood nose, slightly uneven. Four wide paddle-tread desert tires — wide and low-profile for sand and hardpack, dusty sidewalls. Long-travel suspension, vehicle sits low but with significant wheel travel visible at the corners. No roof, no enclosure — open to the sky. A short whip antenna mounted at the rear right corner of the roll cage, bent slightly from impact. Rider in the driver seat: dark balaclava, dark ballistic sunglasses, lightweight tactical vest over dark long-sleeve shirt, dark cargo pants, black boots. One hand on the steering wheel, relaxed posture — this person has driven this ground a thousand times. A compact radio handset mounted on the dash, coiled cable. Passenger seat empty. Hard edge forms, clean material separation. Surface weathering baked in — dust, road grime, scratched paint. No outlines.

**Visual markers**:
- Slim two-seat side-by-side UTV — open roll cage arch, no doors, no windshield
- Four wide paddle-tread desert tires
- Long-travel suspension visible at corners
- Neon green spray stencil on hood nose
- Whip antenna at rear right roll cage corner — bent
- Rider: dark balaclava, ballistic sunglasses, tactical vest
- Radio handset on dash
- Passenger seat empty

**Silhouette**: Low and wide. The UTV body is low to the ground but the open roll cage arch gives it height in the center. Wider than a quad, narrower than a truck. Reads as a fast desert runner — spread wide at the wheels, open overhead.

**Colors**: Primary charcoal `#3D3D3D` roll cage, body panels, tires, rider gear. Secondary neon green `#39FF14` spray stencil on hood nose. Accent bone `#F0EDE0` tire sidewall dust, bare metal scratches on roll cage, dashboard trim.

**Animations**:
- `idle`: engine idles — frame vibrates. Rider scans through sunglasses, shifts one hand on the wheel.
- `move`: UTV surges forward, suspension flexes, dust plumes from rear tires. Rider leans slightly with the terrain.
- `attack`: rider draws sidearm with right hand, fires out the open side, UTV swerves slightly.
- `hit`: UTV bucks hard over impact, rider grabs wheel with both hands, overcorrects.
- `death`: UTV rolls to the side, rider thrown clear, vehicle settles on its roll cage.

---

### Scout (Upgraded) — Black Horse

**File**: `scout2_pistolero.glb`

**Subject**: A black stallion ridden by a cartel scout. Plain black horse — muscular, tall, no armor, no barding. Coat is jet black, mane and tail long and unkempt. Simple rope bridle, no bit. Worn leather saddle, saddlebags behind the rider. Rider wears a black balaclava covering the face, charcoal bulletproof vest over dark clothing, tactical cargo pants tucked into black boots. Neon green tape wrapped around the left wrist. Rider sits upright, one hand on reins, other hand resting near hip. Hard edge forms, clean material separation between horse hide, leather, fabric, nylon. Surface wear baked in.

**Visual markers**:
- Black stallion — jet black coat, long unkempt mane and tail
- No armor on the horse — rope bridle only
- Rider in balaclava and plate carrier
- Neon green tape on left wrist
- Worn leather saddle and saddlebags

**Silhouette**: Tall and commanding. Horse and rider form a classic mounted silhouette. At RTS zoom reads as a dark imposing shape — taller than infantry, narrower than vehicles.

**Colors**: Primary black `#1A1A1A` horse coat, rider clothing, boots, balaclava. Secondary charcoal `#3D3D3D` plate carrier, saddle, cargo pants. Accent neon green `#39FF14` tape on wrist, small marking on saddlebag.

**Animations**:
- `idle`: horse shifts weight, tail swishes. Rider scans surroundings, one hand near hip.
- `move`: full gallop, mane and tail streaming. Rider leans forward in saddle.
- `attack`: rider draws sidearm and fires while riding. Horse maintains stride.
- `hit`: horse rears slightly, rider grabs mane. Recovers.
- `death`: horse crumples forward, rider thrown over the neck.

---

### Artillery — Cañonero

**File**: `artillery_pistolero.glb`

**Subject**: A full-size body-on-frame 4WD SUV converted into a mobile artillery platform. Four-door, long wheelbase, high squared-off roofline — early 2000s American design, wide flat face, chrome horizontal grille bars road-dulled to matte, large square headlights in bezels. Running boards below the doors, paint scuffed and boot-marked. Dark charcoal paint, tinted windows front and rear, lower body seams dust-caked. All-terrain tires on all four corners, sidewalls dusty, tread mud-packed. The rear section of the roof has been cut away and reinforced — a welded steel platform frame bolted through the roof to the chassis, replacing the rear roof panel. A heavy short-barreled mortar tube mounted on a central pivot within the frame — barrel elevated at roughly 45° in firing position, capable of traversing 180°. The mortar tube is dark steel, dust-caked at the base, barrel mouth open and soot-stained inside. The rear cargo hatch remains and opens — stacked ammo canisters visible inside the cargo area. A neon green territorial spray stencil on the hood — a quick block marking, slightly uneven. No external sandbags, no rope — this is a modern cartel weapon platform, not improvised fieldcraft.

**Visual markers**:
- Full-size 4-door SUV — long wheelbase, high flat roofline, early 2000s proportions
- Chrome horizontal grille bars, large square headlights in bezels
- Running boards below doors
- Rear roof section cut away — welded steel reinforcement frame
- Heavy mortar tube on central pivot within roof frame — barrel elevated at 45°
- Soot-stained mortar barrel mouth
- Rear cargo hatch — ammo canisters visible inside
- Neon green spray stencil on hood

**Silhouette**: Tall and wide. The SUV body gives it height and mass. The mortar tube and frame extending above the rear roofline add vertical accent. Reads as a large, purposeful vehicle — not a converted civilian car, a weapon with doors.

**Colors**: Primary charcoal `#3D3D3D` SUV body, mortar tube, roof frame, tires, window tinting. Secondary neon green `#39FF14` spray stencil on hood. Accent bone `#F0EDE0` grille bar detail, headlight bezels, dust on lower body panels, ammo canister labels.

**Animations**:
- `idle`: engine idles — suspension settles. Mortar tube traverses slowly left-right.
- `move`: SUV drives forward, suspension bounces. Mortar tube locked in travel position (barrel lowered into frame).
- `attack`: SUV halts. Mortar tube elevates to firing angle and fires — massive concussive blast, SUV rocks on suspension. Smoke from barrel mouth.
- `hit`: whole vehicle rocks hard, one door panel rattles. Mortar tube swings slightly off axis.
- `death`: rear frame collapses inward, mortar tube drops, SUV lists to one side and settles on flat tires.

---

## Wardens

**Identity**: The old security and maintenance crews who never left their posts. When the collapse happened, everyone else fled or adapted. The Wardens stayed, locked the gates, and kept order in whatever zone they controlled. Bureaucrats with guns. They issue permits nobody asked for, enforce curfews nobody agreed to, and maintain checkpoints on every road they can reach. They don't own the infrastructure — they just decided they're in charge of it. Authority without a state.

**Visual grammar**: Riot shields, high-visibility vests, guard tower aesthetics, crowd control barricades, armored vests with badge insignia, helmet visors, reflective tape, barbed wire accents. Everything says "authorized personnel only." Equipment is institutional — standard issue, not improvised, not flashy. Heavy, protective, fortified.

**Silhouette rule**: **Wide and planted.** Wide stances. Shield shapes dominate the profile. Rounded protective geometry — helmets, shoulder pads, riot shields. At RTS zoom, Wardens read as heavy and institutional — planted, authoritative, not going anywhere. No spikes, no flair — just mass.

**Palette**:

| Role | Hex | Where it goes |
|------|-----|---------------|
| Primary | `#3A3A3A` | Charcoal armor plates, dark riot gear, uniform base, helmet shells, vehicle chassis. The dominant tone — institutional dark, not quite black. Everything looks like it came from the same armory. |
| Secondary | `#FF6B00` | High-visibility orange — vest panels, helmet stripes, barricade markings, reflective tape, warning decals. The signal color — you see the orange before you see the person. Mandatory on every unit. |
| Accent | `#F0F0F0` | White shield faces, badge elements, light trim, visor frames, stenciled text. Clean, institutional, authoritative. |

**Design constraints**:
- Every unit must have a **shield element or riot barrier** component — a physical shield, a barricade plate, a blast panel. This is the faction's defining shape.
- **High-vis orange must appear prominently** — not as subtle trim, as a bold visible panel. This is the Warden identifier. If you can't see the orange at game zoom, it's wrong.
- Armor is **rounded and protective** — no spikes, no jagged edges, no aggressive protrusions. Wardens are defensive. Their gear protects, it doesn't threaten.
- **Badge or authority symbol** on every unit — a stenciled number, an insignia patch, a painted shield emblem. Wardens identify as an organization.
- No flowing fabric. No scarves. No improvisation. Everything is **rigid, structured, institutional** — standard issue.
- No warm earth tones, no turquoise, no yellow. Wardens are charcoal, orange, and white. Institutional, not personal.

---

### Infantry — Security Officers

**File**: `infantry_warden.glb`

**Subject**: Front view only. A riot-equipped security officer standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Full face helmet with a flip-down visor — visor scratched and scuffed across the face from use, orange stripe across the crown faded at the edges. Heavy armored vest over a charcoal uniform — chest plate with a stenciled badge number, the stencil worn and partially legible. Left hand gripping a tall riot shield by the handle — arm extended straight out to the side (white face with orange chevron, shield face impact-marked with dents and scuffs from previous deployments). Right hand gripping a compact 9mm submachine gun by the pistol grip — arm extended straight out to the side, short barrel, side-folding stock collapsed, 30-round curved magazine, iron sights, charcoal finish worn at the corners from holster contact. Reinforced knee and shin guards, shin straps fraying at the velcro edge. Reflective orange tape on shoulders and shins, tape peeling at the corners.

**Visual markers**:
- Full face helmet — charcoal, flip-down visor, orange stripe across crown
- Tall riot shield — white face, orange chevron marking
- Armored vest with stenciled badge number
- Compact 9mm submachine gun — short barrel, folding stock collapsed, 30-round curved mag
- Reflective orange tape on shoulders and shins
- Wide planted stance — not moving unless they decide to

**Silhouette**: Wide and planted. Riot shield extends the width significantly on one side. Helmet adds height over a heavy, grounded body. The shield dominates — one side heavy, one side open.

**Colors**: Primary charcoal `#3A3A3A` helmet, vest, uniform, shin guards. Secondary high-vis orange `#FF6B00` helmet stripe, shoulder tape, shin tape, shield chevron. Accent white `#F0F0F0` shield face, badge number, visor frame.

**Animations**:
- `idle`: weight shifts behind shield. Visor glints. Weapon hand adjusts grip.
- `move`: shield-first advance — crouched behind shield, weapon tucked, steady march.
- `attack`: steps out from behind shield, fires submachine gun in a short burst. Snaps back behind shield.
- `hit`: shield absorbs impact — arm rocks back, feet slide but hold. Shield dents.
- `death`: shield drops first, then knees buckle, collapses sideways behind fallen shield.

---

### Infantry (Upgraded) — EOD Officer

**File**: `infantry2_warden.glb`

**Subject**: Front view only. A bomb disposal officer standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Full EOD bomb suit — massive padded torso, thick protective collar rising above the shoulders to jaw level, heavy armored limbs with segmented padding at elbows and knees. Blast visor down — dark rectangular viewport in a heavy face plate, visor scratched from use. Charcoal suit body with reflective orange tape on both shoulders and across the chest. Stenciled badge number on the chest plate, partially worn. Right hand gripping a rotary grenade launcher — arm extended straight out to the side, six-round cylinder, short stubby barrel, charcoal finish worn at the grip. Heavy armored boots, shin guards integrated into the suit. Hard edge forms, clean material separation between padded suit material, visor glass, reflective tape, metal weapon. Surface wear baked in.

**Visual markers**:
- Full EOD bomb suit — massive padded torso, thick collar, heavy limbs
- Blast visor down — dark viewport, scratched
- Rotary grenade launcher — six-round cylinder, short barrel
- Reflective orange tape on shoulders and chest
- Stenciled badge number on chest plate

**Silhouette**: Wide and bulky. Bomb suit makes the torso enormous. Thick collar rises above shoulders. At RTS zoom reads as the widest, heaviest infantry shape — a walking wall of padding.

**Colors**: Primary charcoal `#3A3A3A` bomb suit body, visor frame, grenade launcher. Secondary high-vis orange `#FF6B00` reflective tape on shoulders, chest stripe, helmet marking. Accent white `#F0F0F0` badge number stencil, visor frame trim.

**Animations**:
- `idle`: slow weight shift. Suit creaks. Grenade launcher held steady at side.
- `move`: heavy plodding stride — slowest infantry in the game. Bomb suit restricts movement.
- `attack`: raises grenade launcher, fires single round. Cylinder rotates. Thump recoil.
- `hit`: suit absorbs impact — barely moves. Visor cracks.
- `death`: suit locks up, tips backward like a felled statue. Crashes onto back. Does not get up.

---

### Tank — Armored Response Vehicle

**File**: `tank_warden.glb`

**Subject**: A heavy six-wheeled armored personnel carrier converted into an enforcement vehicle — wide, flat-faced, institutional. Flat vertical front face with a horizontal slit viewport at driver height, two large round headlights recessed into the front panel. Rectangular cross-section hull — flat top, flat sides, squared-off rear — painted charcoal with road grime packed into the panel seams, scratches along the lower sides from debris, wheel wells dust-caked. Six dual wheels on three axles, heavy-duty rubber, flat tread. A roof-mounted rotating turret — compact housing, water cannon barrel extending forward, turret housing surface scuffed and stained from field use. Fold-out blast shields hinged along both flanks — when deployed they extend outward to form lateral barricade walls, shield outer face dented and impact-marked, orange chevron stripes along the outer edge worn at the fold crease. Front-mounted reinforced push bumper — thick rectangular section steel, chrome worn to matte, bend marks from use. Orange and white chevron striping across the bumper face and blast shield outer faces, chevron paint edges worn and chipped. A loudspeaker horn mounted on the roof beside the turret, housing surface-scuffed. Stenciled "WARDEN" on the near-side flank, stencil ink faded and uneven. Hard edge forms, clean material separation. Surface weathering baked in — road grime, panel scratches, dust. No outlines.

**Visual markers**:
- Flat-faced APC hull — flat front, slit viewport, round recessed headlights
- Six dual wheels on three axles
- Roof turret — compact, water cannon barrel, rotates
- Fold-out blast shields on both flanks — orange chevron on outer face
- Front reinforced push bumper — thick section, worn chrome
- Loudspeaker horn on roof
- Stenciled "WARDEN" on flank — faded

**Silhouette**: Wide and planted. Blast shields when deployed extend the width dramatically. Flat-topped, flat-sided — reads as a rolling barrier. Heavy mass, low roofline.

**Colors**: Primary charcoal `#3A3A3A` hull, wheel wells, turret base, push bumper. Secondary high-vis orange `#FF6B00` chevron striping, turret housing, warning decals. Accent white `#F0F0F0` chevron stripes (alternating with orange), stenciled text, blast shield inner face.

**Animations**:
- `idle`: turret traverses slowly (scanning). Loudspeaker crackles (vertex flash). Engine hums.
- `move`: push bumper dips forward, suspension compresses. Wheels roll. Blast shields retracted.
- `attack`: turret snaps to target, fires water cannon / gas burst. Vehicle rocks slightly. Blast shields deploy for brace.
- `hit`: hull rocks sideways, a blast shield dents. Loudspeaker rattles.
- `death`: turret jams, one blast shield falls off, vehicle settles onto flat tires. Loudspeaker dies mid-crackle.

---

### Scout — Surveillance Drone

**File**: `scout_warden.glb`

**Subject**: A small quad-rotor surveillance drone — flat rectangular body, utilitarian, standard-issue. Flat slab body roughly 30cm wide and 20cm front-to-back, charcoal plastic shell with visible panel seams and recessed hex bolt heads. A camera pod on a two-axis gimbal hanging below the body center — camera lens dusty at the edges, lens housing scratched from field deployment, gimbal arm scratched at the pivot. Four rotor arms extend at 45° from the body corners — each arm is a flat extruded rectangle, not tapered, ending in a rotor disc with a thin circular guard ring around it, orange-painted, paint chipped at the impact points on the guard edge. A small flashing orange warning light on the top surface, housing surface sun-faded. A short antenna stub at the rear, the stub base reinforced with a visible epoxy repair. Serial number stenciled on the underside near the gimbal — ink faded from sun exposure. Surface of the body scuffed across the top panel, one corner of the body has a stress crack repaired with black foil tape. Hard edge forms, clean material separation. Surface weathering baked in — scuffs, dust, sun fade. No outlines.

**Visual markers**:
- Flat slab rectangular body — panel seams, recessed hex bolts, charcoal plastic
- Camera pod on two-axis gimbal below body — dusty lens
- Four rotor arms at 45° with thin circular guard rings — orange guard rings
- Orange warning light on top — sun-faded housing
- Short antenna stub at rear — epoxy repair at base
- Serial number stenciled on underside — faded
- Stress crack repaired with foil tape at one corner

**Silhouette**: Flat cross shape from above. Compact flat body with four arms extending at 45°. From the side: a thin flat slab with a small pod hanging below. Reads as a real surveillance tool — proportional, functional.

**Colors**: Primary charcoal `#3A3A3A` body, camera pod, antenna. Secondary high-vis orange `#FF6B00` rotor guards, warning light, accent markings. Accent white `#F0F0F0` lens ring, serial number, rotor guard inner face.

**Animations**:
- `idle`: hovers with minimal bob ±2px. Camera gimbal pans left-right (scanning). Warning light blinks.
- `move`: tilts forward, rotor guards catch light. Warning light blink rate increases.
- `attack`: camera pod locks on target, emits targeting pulse (vertex flash on lens). Body recoils slightly.
- `hit`: one rotor guard clips, drone lurches. Warning light flickers. Recovers with overcorrection.
- `death`: rotor pair fails, drone tilts, spirals down. Warning light stays on as it crashes (stubborn institutional equipment).

---

### Scout (Upgraded) — Bloodhound

**File**: `scout2_warden.glb`

**Subject**: A giant bloodhound the size of a horse, ridden by a security officer. Massive tracking dog — long drooping ears hanging past the jaw, deep wrinkled face, heavy jowls, sad drooping eyes. Short tan-brown coat, muscular body, huge paws. No armor on the dog — wild tamed. Simple leather saddle with reflective orange tape on the straps, rope reins. Rider wears a charcoal security helmet with flip-down visor, orange stripe across the crown, armored vest with stenciled badge number, reinforced knee guards. Rider sits upright, one hand on reins. Hard edge forms, clean material separation between dog hide, leather, fabric, armor plate. Surface wear baked in.

**Visual markers**:
- Giant bloodhound — long drooping ears, wrinkled face, heavy jowls
- Massive paws, muscular body, short tan-brown coat
- No armor on the dog — saddle with orange reflective tape
- Rider in security helmet and armored vest with badge number
- Orange stripe on helmet, reflective tape on saddle straps

**Silhouette**: Low and heavy. Bloodhound's body is wide and low-slung, drooping ears extend the width. Rider adds height. At RTS zoom reads as a heavy low shape with distinctive floppy ear silhouette.

**Colors**: Primary tan-brown dog coat. Secondary charcoal `#3A3A3A` rider helmet, vest, uniform. Accent high-vis orange `#FF6B00` helmet stripe, reflective tape on saddle, shoulder tape.

**Animations**:
- `idle`: bloodhound sniffs the ground, ears sway. Rider adjusts visor.
- `move`: loping gallop, ears flapping, jowls bouncing. Rider leans forward.
- `attack`: bloodhound lunges with open jaws, deep bark. Rider braces in saddle.
- `hit`: dog stumbles sideways, yelps. Rider grabs saddle horn.
- `death`: bloodhound collapses to its side, ears spread on ground. Rider rolls off.

---

### Artillery — Mobile Gun Platform

**File**: `artillery_warden.glb`

**Subject**: A heavy four-wheeled armored utility truck with a raised gun platform welded onto the rear — a checkpoint tower on wheels. The truck: single cab, short, flat-faced with a horizontal slit viewport at driver height, two round recessed headlights. Angular charcoal hull, door stenciled "WARDEN" in faded white paint. Running boards, reinforced bumper. Four dual wheels with flat-tread institutional tires, wheel wells dust-caked. The rear of the vehicle carries a welded steel elevated platform — accessed by a short fixed ladder bolted to the rear corner, platform sitting about one meter above the truck bed. The platform has a chest-high armored parapet on three sides — white-faced blast panels with orange chevron striping, panel faces dented and impact-scuffed. A long-barreled heavy gun mounted on a pintle behind the parapet — barrel blued with use at the muzzle, pintle joint oil-darkened. A spotlight mounted on the platform's front-left corner, housing dented, lens scratched. A small orange warning light on a pole above the parapet, housing sun-faded. Sandbags stacked at the base of the platform on the truck bed, fabric stained. The whole thing reads as a checkpoint that can drive to the next road.

**Visual markers**:
- Single-cab flat-faced armored truck — slit viewport, round recessed headlights
- "WARDEN" stenciled on door in faded white
- Raised elevated platform on rear — welded steel, accessed by short fixed ladder
- Armored parapet on platform — white blast panels, orange chevron
- Long-barreled gun on pintle behind parapet
- Spotlight on platform corner
- Orange warning light on pole above parapet
- Sandbags stacked on truck bed at platform base

**Silhouette**: Vertical and tall. Truck cab at bottom, elevated platform above — gun and warning light at the top. Tallest Warden unit. Reads as a moving checkpoint tower — authoritative height on a vehicle base.

**Colors**: Primary charcoal `#3A3A3A` truck hull, platform frame, gun barrel, ladder, parapet steel. Secondary high-vis orange `#FF6B00` warning light, parapet chevron, spotlight housing. Accent white `#F0F0F0` parapet blast panels, "WARDEN" stencil on door, spotlight lens.

**Animations**:
- `idle`: spotlight sweeps slowly. Gun barrel drifts in small arcs. Warning light blinks. Engine idles — cab vibrates.
- `move`: truck drives, suspension bounces. Platform sways slightly. Gun barrel locked in travel position. Warning light blink rate holds steady.
- `attack`: truck halts. Gun elevates to firing angle, fires. Recoil shakes the platform and rocks the truck on its suspension. Spotlight locks on target.
- `hit`: truck rocks hard, a sandbag slides off the bed. Platform shudders. Spotlight swings.
- `death`: gun drops, platform collapses inward, truck cab crumples. Warning light stays blinking as the vehicle settles.

---

## Greasers

**Identity**: Street kids who inherited the unfinished highways. When the construction boom collapsed mid-pour, the Greasers took the empty roads for themselves. They didn't fight over buildings or power grids — they claimed asphalt. Decades of car culture, chop shops, and drag racing gave them machines nobody else could match on a straightaway. Fast, loud, and territorial. They don't hold cities. They own the roads between them. You pay a toll or you don't pass.

**Visual grammar**: Road-worn black paint, road-dulled chrome, whitewall tires scuffed at the edges, hand-painted pinstripes, pompadours held with grease, battered leather jackets, dirty white tees, scuffed engineer boots, switchblades. These people take pride in how their machines look — but the machines have been driven hard. Paint chips at the door edges. Chrome is polished but exhaust-stained. Jeans are faded from the sun. This is a look that's been lived in.

**Silhouette rule**: **Low and wide.** Every vehicle is slammed close to the ground. No cranes, no towers, no verticals. Infantry stance is wide-legged and loose — weight back, chin up. At RTS zoom, Greasers are the flattest shapes on the field. They spread out rather than rise up.

**Palette**:

| Role | Hex | Where it goes |
|------|-----|---------------|
| Primary | `#1A1A1A` | Gloss black — leather jackets, vehicle body paint, pomaded hair, tire sidewalls, engine blocks. The faction's dominant tone. Everything that defines a Greaser is black. |
| Secondary | `#D0D0D0` | Chrome — bumpers, exhaust pipes, hubcaps, belt buckles, zipper pulls, handlebars, mirror housings. The contrast that makes the black pop. |
| Accent | `#C1272D` | Cherry red — pinstripes on vehicles, flame decals on noses and hoods, bandanas, brake calipers, lipstick on the one unit that wears it. Used for detail lines, never as fill. |

**Design constraints**:
- Every vehicle must be **lowered** — suspension slammed, body sitting 2–3 inches from the ground. Greasers don't ride high.
- **Whitewall tires** on every vehicle. The white band is narrow — about 1 inch — but visible. This is non-negotiable faction identity.
- Chrome is **polished but road-dulled** — cared for, not showroom. Exhaust pipes are soot-stained at the tips. Bumpers have road rash at the corners.
- **Cherry red pinstripes** run along at least one body line on every vehicle — a single thin line, hand-painted style.
- No welded scrap, no improvised armor, no mismatched panels. Vehicles are stock bodywork, modified for performance and style, not warfare. The weapons are aftermarket additions, not structural replacements.
- Infantry carry **switchblades** (visible handle in back pocket) and **sawed-off double-barrel shotguns** — short, brutal, personal.

---

### Infantry — Street Fighter

**File**: `infantry_greaser.glb`

**Subject**: Front view only. A lean street fighter standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Late teens or early twenties. Hair is a full pompadour — sides slicked back tight, front piled into a pronounced wave with grease-darkened pomade. Road dust in the hair at the temples. Battered black leather motorcycle jacket: lapels folded back, two chest pockets with snap buttons, zippered cuffs, chrome zipper pulls dulled from use, slightly oversized through the shoulders — creased and scuffed at the elbows from road falls. Dirty white cotton T-shirt underneath, tucked but slightly pulling out at one hip. Faded indigo denim jeans — sun-bleached at the thighs and knees, slim straight cut, cuffed twice at the ankle exposing about two inches of grimy white cotton sock. Scuffed black leather engineer boots: pull-loop tabs on both sides of the shaft, stacked block heel worn down slightly at the outer edge, toe box steel-reinforced and blunt, shaft rising to mid-calf with crease marks across the instep. A crumpled pack of cigarettes rolled into the left sleeve at the bicep. A switchblade in the right rear pocket — just the black handle protruding above the denim. Right hand gripping a sawed-off double-barrel shotgun — arm extended straight out to the side, stock removed, grip taped with black electrical tape. Build: lean, not muscular.

**Visual markers**:
- Pompadour — glossy black, high wave front, tight sides, tallest point on the model
- Black leather jacket — chrome zippers, snap pockets, broad through the shoulders
- White tee tucked into cuffed dark indigo jeans
- White sock visible in the cuff gap
- Engineer boots — block heel, pull tabs, blunt steel toe
- Cigarette pack rolled into left sleeve
- Switchblade handle protruding from right rear pocket
- Sawed-off double-barrel shotgun, stock removed, held one-handed

**Silhouette**: Tall pompadour over a lean vertical body, wide-leg stance. The jacket's shoulder line is wider than the hips. At game zoom: a dark T-shape with a distinctive hair spike at the top.

**Colors**: Primary black `#1A1A1A` jacket, hair, boots, jeans. Secondary chrome `#D0D0D0` zipper pulls, boot eyelets, belt buckle. Accent red `#C1272D` slim bandana knotted loosely at the throat, peeking above the jacket collar.

**Animations**:
- `idle`: weight shifts to one hip. Right hand drops to shotgun grip. Left hand adjusts jacket lapel. Slow head turn — checking both directions.
- `move`: loose-limbed forward stride, shotgun at hip. Jacket collar flaps slightly. Boot heels strike hard.
- `attack`: raises shotgun with both hands, fires from the hip. Double recoil snaps both barrels back. Breaks it open with one hand, ejects shells.
- `hit`: spins a half-step from impact, catches balance with one leg out wide. Hand goes to face.
- `death`: drops shotgun, staggers back two steps, slides down against nothing — ends seated with legs forward, slumped.

---

### Infantry (Upgraded) — The Wrecker

**File**: `infantry2_greaser.glb`

**Subject**: Front view only. A large shirtless street fighter standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Broad shoulders, thick arms, barrel chest. No shirt — bare torso and arms covered in American traditional tattoos: bold black outlines, limited color. A black panther mid-leap across the entire chest — head on the left pec, claws extended to the right, bold black fill with yellow eyes. A heart with a banner reading MOM on the left upper arm. An eagle with spread wings across the upper back visible at the shoulders. A dagger through a rose on the right forearm. An anchor on the left forearm. A spiderweb on the right elbow. All tattoos bold black outlines, flat color fills — red, green, yellow — no fine line work, no tribal, no modern style. Full pompadour — glossy black hair, high wave front. Red bandana tied around the forehead. Faded indigo jeans, wide cut, cuffed at the ankle. Scuffed black engineer boots, steel toe exposed from wear. Right hand gripping a heavy steel car engine block on a thick chain — arm extended straight out to the side, chain links hanging, engine block dangling below the fist. Left hand empty, knuckles tattooed with block letters. Hard edge forms, clean material separation between bare skin, tattoo ink, denim, steel. Surface wear baked in — grease stains on jeans, road grime on boots.

**Visual markers**:
- Shirtless — bare torso covered in American traditional tattoos
- Black panther mid-leap across the chest — bold black, yellow eyes
- MOM heart banner on left upper arm
- Engine block on a chain — held in right hand, swinging
- Full pompadour, red bandana on forehead
- No shirt, no vest, no armor — just skin and ink

**Silhouette**: Wide and raw. Bare tattooed torso reads as the widest infantry shoulders. Engine block on chain hangs low on one side. At RTS zoom reads as a big dark shape with something heavy swinging.

**Colors**: Primary black `#1A1A1A` tattoo outlines, hair, boots, jeans. Secondary skin tone — bare chest and arms as the canvas. Accent red `#C1272D` bandana, tattoo fills (heart, rose), cherry red pinstripe detail on the chain.

**Animations**:
- `idle`: rolls shoulders, chain drags on ground. Engine block scrapes. Head turns slow.
- `move`: heavy forward stride, engine block dragging behind. Chain clinks with each step.
- `attack`: winds up, swings engine block overhead in an arc. Chain extends full length. Crashes down.
- `hit`: absorbs impact, barely moves. Spits. Adjusts grip on chain.
- `death`: drops chain, engine block thuds. Sinks to knees, falls forward flat. Tattoos face up.

---

### Scout — Café Racer

**File**: `scout_greaser.glb`

**Subject**: A late-1960s British parallel-twin café racer motorcycle ridden by a solo scout. The motorcycle: narrow alloy fuel tank with pronounced knee-cutout indentations on both sides, painted flat black — paint worn through to bare metal at the knee contact points, a single cherry red pinstripe along the tank centerline chipped and faded at the ends. Clip-on handlebars mounted directly to the fork tubes — low, almost horizontal, forcing the rider into a deep forward crouch. No front fender. No rear fender — road grime streaked up the tail section from the rear tire. Exposed parallel-twin engine with visible cooling fins on the cylinder heads, oil-darkened around the base gaskets, chromed rocker covers road-dulled and soot-stained. Twin upswept exhaust pipes on the right side only, ending in short megaphone-flare tips blued and blackened from heat. Wire-spoke wheels: chrome rims scratched from road debris, 18-inch front and rear, narrow profile tires with a thin whitewall band grimy at the edges. Rear-set footpegs welded to the lower frame rails. Single seat — a cracked, flat leather pad held together at one corner with a strip of black electrical tape — with a small fiberglass tail cowl behind it, scratched and road-chipped. No windscreen, no fairing. Chrome headlight bucket dulled to a matte sheen, round, single, mounted on the fork crown. The rider: pompadour hair compressed but visible below the helmet edge, greased and road-flattened. Open-face pudding-bowl helmet — scuffed black, no chin bar, no visor — with a pair of round aviation-style goggles, lens rims scratched, pushed up onto the helmet dome. Slim-cut black leather café racer jacket — tight fit, no lapels, stand-up collar, diagonal chest zipper, quilted padding panels at shoulders and elbows worn smooth, zippered cuffs. Faded indigo jeans cuffed twice. Same scuffed engineer boots. No scarf — stripped down for speed.

**Visual markers**:
- Clip-on handlebars — low, nearly horizontal, distinctive racer posture
- No fenders — exposed front and rear wheel, open frame visible
- Twin upswept megaphone exhausts on right side only — asymmetric exhaust, right-side visual weight
- Visible parallel-twin engine with chrome rocker covers and finned cylinders
- Wire-spoke wheels with narrow whitewall band
- Single small tail cowl — no passenger seat, no luggage
- Pudding-bowl helmet — gloss black dome with goggles pushed up
- Pompadour hair compressed but visible below helmet edge
- Slim café racer jacket — diagonal zip, quilted shoulders, stand-up collar

**Silhouette**: Long and low. Rider crouched flat over the tank, head down, elbows wide. The bike is narrow; the rider's crouch makes the whole unit read as a horizontal dart. Thinner and more aggressive than the Caravaner's upright dirt bike silhouette.

**Colors**: Primary black `#1A1A1A` fuel tank, jacket, helmet, tire sidewalls, engine block. Secondary chrome `#D0D0D0` exhaust pipes, wheel rims, headlight bucket, rocker covers, handlebars. Accent red `#C1272D` pinstripe along tank centerline.

**Animations**:
- `idle`: engine ticks at idle — slight frame vibration. Rider sits upright briefly, rolls neck. One hand revs throttle (frame pulse).
- `move`: rider drops into full crouch over tank, elbows out, head below handlebar line. Speed lean.
- `attack`: rider draws sidearm with right hand while steering one-handed, fires to the side. Bike swerves slightly from the shift in weight.
- `hit`: front wheel bucks, rider grips tank with knees, recovers with overcorrection.
- `death`: rear wheel slides out, bike lays down at speed, rider and bike slide together across ground.

---

### Scout (Upgraded) — Racing Greyhound

**File**: `scout2_greaser.glb`

**Subject**: A giant racing greyhound the size of a horse, ridden by a street fighter. Lean muscular dog — deep chest, tucked waist, long thin legs built for speed. Short smooth brindle coat, dark with lighter streaks. Long narrow snout, alert ears folded back. Numbered racing vest — black with white number 7, slightly torn at the edges. No armor on the dog — wild tamed. Simple leather saddle low on the back, rope reins. Rider wears a battered black leather motorcycle jacket, dirty white t-shirt, faded indigo jeans cuffed at the ankle, scuffed black engineer boots. Full pompadour — glossy black hair, high wave front. Rider crouched low on the saddle. Hard edge forms, clean material separation between dog hide, leather, fabric, denim. Surface wear baked in.

**Visual markers**:
- Giant racing greyhound — lean, deep chest, tucked waist, long thin legs
- Numbered racing vest — black with white 7, torn edges
- Short smooth brindle coat
- Rider in leather jacket, pompadour, engineer boots
- Crouched low riding posture — speed stance

**Silhouette**: Low and long. Greyhound's body is streamlined and horizontal — deep chest tapering to narrow waist. At RTS zoom reads as the fastest, leanest shape on the field.

**Colors**: Primary black `#1A1A1A` leather jacket, dog's dark brindle base, racing vest, boots. Secondary chrome `#D0D0D0` jacket zipper pulls, boot buckles. Accent white number 7 on racing vest, dirty white t-shirt.

**Animations**:
- `idle`: greyhound shifts weight, muscles twitch. Rider adjusts grip on reins.
- `move`: full sprint, double-suspension gallop, ears pinned back. Rider crouched flat against neck.
- `attack`: greyhound snaps forward with jaws. Rider swings with one hand.
- `hit`: dog stumbles mid-stride, catches balance. Rider grabs saddle.
- `death`: greyhound tumbles forward at speed, rolls. Rider thrown clear.

---

### Tank — Forward-Control Panel Van

**File**: `tank_greaser.glb`

**Subject**: A mid-1960s American forward-control panel van — engine under the cab floor, completely flat nose with no hood protrusion. Paint is flat black, faded to a chalky dark grey on the roof and upper panels from sun exposure, road-chipped along the lower body. The body: boxy and upright, slightly rounded nose — not a sharp corner, a gentle radius. Windscreen is a two-piece split pane: two flat rectangular glass sections meeting at a center divider pillar, glass yellowed at the corners. No side windows behind the B-pillar — solid faded panels on both sides. The sliding door on the right side: a flat panel on a top rail, chrome D-ring pull handle worn to bare metal where fingers grip it. Rear barn doors — two equal panels each with a chrome lever latch darkened with grease, door edges road-chipped. The van is slammed — lowered suspension, body sitting close to the ground, scrape marks on the lower nose from bottoming out. Tires: four wheels with baby-moon hubcaps — flat disc covering the wheel center, chrome dulled to a satin finish, road-speckled — narrow whitewall tires with the white band grimy from road spray. A welded steel gun ring mount on the roof forward of the sliding door — a circular steel hoop on a pedestal with a pintle-mounted heavy machine gun, weld beads raw and unpainted, bolts greasy. Cherry red flame decals on the flat nose and front quarter panels: classic hot rod flame shapes — pointed teardrops, the largest starting at the front corners tapering back toward the wheel wells, edges peeling at the tips.

**Visual markers**:
- Completely flat nose — no hood, no protrusion, engine under the floor
- Split two-pane windscreen with center pillar
- Solid side panels, no windows behind B-pillar
- Sliding right-side cargo door with chrome D-ring handle
- Baby-moon chrome hubcaps with narrow whitewall tires
- Slammed ride height — body close to ground
- Welded steel gun ring mount with pintle machine gun on roof
- Cherry red hot rod flame decals on flat nose and front quarter panels

**Silhouette**: The van body sits very low — long flat sides, flat roof — with a gun ring stub breaking the roofline. At game zoom: a flat low rectangle with a compact weapon mount on top. Nothing else on the roster looks like this.

**Colors**: Primary black `#1A1A1A` van body paint, tire sidewalls. Secondary chrome `#D0D0D0` hubcap faces, door handle, windscreen divider, bumperettes. Accent red `#C1272D` flame decals on nose and front quarters.

**Animations**:
- `idle`: engine hum through the floor — whole body vibrates at low frequency. Gun ring traverses slowly.
- `move`: van body rocks on lowered suspension, nose dips. Gun ring locks forward.
- `attack`: gun ring traverses to target, machine gun fires in short bursts. Van rocks from recoil. Brass casings eject.
- `hit`: van bucks sideways, one barn door pops open and swings. Gun ring wobbles.
- `death`: roof mount cracks, gun ring tips sideways. Van settles on flat tires, nose down.

---

### Artillery — Squarebody Flatbed

**File**: `artillery_greaser.glb`

**Subject**: A late-1960s American medium-duty flatbed truck, two-axle, conventionally cabbed — not a semi, not cab-over. The cab: two-door, short, with a chopped roof (visibly lowered — the roofline is about three inches lower than the original stamping, the pillars cut and rewelded with visible seam lines). Paint is flat black with road chips along the lower door edges and front corners, dust settled into the panel gaps. Wide flat rectangular grille with five horizontal chrome bars, road-dulled and bug-pitted. Twin round headlights set into square chrome bezels, one on each side of the grille. Massive flat front bumper — extends the full width of the truck, thick rectangular section, chrome worn to a matte sheen with road rash at the corners. Hood is flat on top with a slight center ridge, two rectangular chrome hood latches darkened with grease. Chrome door handles worn smooth from use. Chrome side mirror on the driver's side only — round convex glass in a chrome housing on a single arm, mirror glass cracked at one edge. Wide flat running boards below the doors, paint scuffed and boot-marked. The bed: an open flatbed with oil-stained wooden deck planks running front-to-back, steel stake-pocket rails along both sides. The roof has been cut with a rectangular opening in the rear two-thirds of the bed, framed by a welded steel collar — weld beads left rough and unpainted, steel surface rust-spotted from weather exposure. Rising from the collar: a 2x2 grid of four short mortar tubes, each about 30cm long, steel, scorched black at the muzzle ends from firing, angled rearward at 75 degrees from horizontal (nearly vertical, slight backward lean). The tubes are welded to a common steel baseplate on a pivot bolt, the bolt head stripped from adjustment. A steel handle on the side of the baseplate — bare metal, hand-worn smooth. Tires: all six wheels mounted on five-spoke steel wheels with a 1.5-inch whitewall band grimy at the road edge. Dual exhaust stacks rise behind the cab, soot-blackened from the cut ends down six inches. Cherry red pinstripe runs along the cab body line from headlight to door — hand-painted, slightly wavering, chipped at the door crease. A pair of fuzzy dice — black cubes with white pips, road-grimed — hang from the rearview mirror.

**Visual markers**:
- Chopped roof — roofline visibly lower than factory, reweld seam lines visible on pillars
- Five-bar chrome horizontal grille
- Twin round headlights in square chrome bezels
- Full-width thick chrome front bumper
- Chrome five-spoke steelies with narrow whitewall band, all six wheels
- Dual chrome straight-cut exhaust stacks behind cab
- Open wooden flatbed with steel stake rails
- 2x2 four-tube mortar array angled at 75 degrees, on a pivot baseplate with manual adjust handle
- Fuzzy dice on rearview mirror
- Cherry red pinstripe: cab body line and flatbed top rail

**Silhouette**: Wide, low, and horizontal. Chopped roof shortens the cab profile. The flatbed extends the truck's length with the mortar cluster rising above the bed. At game zoom: a flat rectangle with a small cab bump at one end and a stubby chimney cluster above the bed.

**Colors**: Primary black `#1A1A1A` cab body, flatbed deck planks, stake rails, running boards. Secondary chrome `#D0D0D0` grille bars, bumper, headlight bezels, door handles, mirrors, exhaust stacks, wheel faces. Accent red `#C1272D` pinstripe on cab body line and flatbed top rail.

**Animations**:
- `idle`: engine rumble — cab vibrates with low frequency. Fuzzy dice sway slowly. Exhaust stacks pulse. Mortar array sways slightly on its pivot.
- `move`: cab dips forward slightly as truck accelerates. Flatbed bounces on rough road. Dice swing harder. Array locks down.
- `attack`: array pivots to firing angle. Tubes fire in sequence — one, two, three, four, each with a distinct thump and smoke puff. Flatbed rocks backward with each shot. Brass casings arc.
- `hit`: whole truck rocks to one side. Chrome bumper dents (vertex shift). Dice swing violently. Array wobbles.
- `death`: front axle drops, truck nose digs in. Array tips and falls sideways. Cab crumples on one side.

---

## The Current

**Identity**: Someone figured out how to keep the power on. In a world where every grid went dark, The Current controls the last functioning power infrastructure — substations, relay towers, transformer stations. They didn't fight for territory or scrap. They fought for the grid. Control energy, control everything. Every faction needs power. Every faction negotiates with The Current or goes without. They are calm, precise, and absolutely ruthless about protecting their network. They don't hate you — they'll just cut your power and watch.

**Visual grammar**: Power conduits, transformer cores, capacitor banks, insulated suits, Tesla coil antennas, blue arc glow, ceramic plating, sealed housings. Everything looks manufactured — clean, modular, engineered. These people maintain infrastructure, and their equipment reflects it. No rust, no scrap, no improvisation. If Scrappers are chaos, The Current is order.

**Silhouette rule**: **Tall, thin, vertical.** Antenna spikes reach up. Tesla coils tower. Tripod legs are narrow. At RTS zoom, The Current units are the tallest and thinnest shapes — antenna-like, electrical, reaching skyward.

**Palette**:

| Role | Hex | Where it goes |
|------|-----|---------------|
| Primary | `#1E90FF` | Arc glow, Tesla coil discharge, capacitor charge, LED strips, thrust pod glow, electrode arcs, running lights. The signature color — electric blue means power is flowing. Used for anything that glows or crackles. |
| Secondary | `#E8ECF0` | Insulated suit bodies, ceramic plating, chassis panels, barrel housings, tripod legs, disc body, generator casing. The clean structural tone — cool white, slightly blue-shifted. |
| Accent | `#0A0A28` | Near-black navy. Cable insulation, sealed compartments, sensor lenses, boot soles, power conduits, console frames. The deep shadow that makes the blue glow pop. |

**Design constraints**:
- Every unit must have at least one **active blue glow** — an arc, an LED strip, a capacitor charge, a running light. The Current's units always look powered on. If the blue glow dies, the unit is dead.
- **No rust, no corrosion, no mismatched parts.** The Current maintains their equipment. Surfaces are clean, panels are sealed, components are modular. The opposite of Scrappers.
- **Insulation everywhere.** Rubber coating, ceramic plates, sealed housings. These people work with lethal voltage — their gear reflects the danger.
- The blue glow should **intensify during attack animations** and **flicker during hit animations.** Power level = combat status.
- **Vertical elements** on every unit — antennas, Tesla coils, tripod legs, whip antennas. The Current reaches up toward the power lines.
- No warm colors. No orange, no copper, no yellow. The Current palette is cold — blue, white, navy. If it looks warm, it's not Current.

---

### Infantry — Grid Technicians

**File**: `infantry_current.glb`

**Subject**: Front view only. A power grid technician standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Full insulated suit. Thick rubber-coated coveralls with ceramic plate reinforcement at chest and shoulders. Sealed hood with a clear visor (blue tint). Heavy insulated gloves. Right hand gripping a live-wire tool — a long insulated rod with a crackling arc tip, arm extended straight out to the side. Small transformer box strapped to the back, humming with power, cooling vents visible. Blue LED indicator strips run along the suit seams.

**Visual markers**:
- Full insulated suit — thick, sealed, ceramic plates at chest/shoulders
- Clear visor with blue tint on sealed hood
- Live-wire tool — insulated rod with crackling arc tip
- Transformer backpack — small box with cooling vents, humming
- Blue LED strips along suit seams
- Tall, upright, controlled posture

**Silhouette**: Tall and clean. Smooth vertical profile — no ragged edges, no asymmetry. Transformer backpack and arc tool add modest bulk. "Technical, dangerous, in control."

**Colors**: Primary electric blue `#1E90FF` LED strips, arc tip crackle, visor tint, suit trim. Secondary white `#E8ECF0` suit body, ceramic plates, gloves, hood. Accent navy `#0A0A28` suit underlayer, transformer box, boot soles.

**Animations**:
- `idle`: arc tool tip crackles (vertex color pulse blue↔white). LED strips pulse slowly. Controlled breathing.
- `move`: measured stride, arc tool at ready. Transformer hum increases (subtle backpack vibration).
- `attack`: arc tool extends forward, discharges sustained arc. Blue-white flash at tip. Controlled recoil.
- `hit`: staggers one step, ceramic plate cracks (vertex shift). LEDs flicker.
- `death`: transformer overloads — blue flash cascades through suit. Collapses straight down, arc tool discharges into ground.

---

### Infantry (Upgraded) — Arc Trooper

**File**: `infantry2_current.glb`

**Subject**: Front view only. A heavy power grid soldier standing in a T-pose — arms straight out to the sides at shoulder height, legs slightly apart. Heavier insulated suit than base infantry — thicker rubber-coated coveralls with reinforced ceramic plating across chest, shoulders, and forearms. Sealed hood with a clear visor tinted blue, visor larger and more heavily framed than base infantry. Massive Tesla coil backpack — exposed copper coils wound in a vertical helix, capacitor banks on both sides, cooling vents humming, blue arcs crackling between the coil terminals. Heavy insulated gloves with copper-tipped fingers. Blue LED indicator strips along all suit seams — brighter and more numerous than base infantry. Right hand gripping an arc projector cannon — arm extended straight out to the side, two-handed weapon with an insulated barrel, copper electrode tips at the muzzle, power cable running from the weapon back to the Tesla coil backpack. Heavy insulated boots with copper grounding strips on the soles. Hard edge forms, clean material separation between rubber suit, ceramic plate, copper coils, electrode metal. Surface wear baked in.

**Visual markers**:
- Massive Tesla coil backpack — exposed copper helix, capacitor banks, arcs between terminals
- Arc projector cannon — insulated barrel, copper electrode tips, power cable to backpack
- Heavier ceramic plating on chest, shoulders, forearms
- Brighter, more numerous blue LED strips along all seams
- Copper-tipped gloves, copper grounding strips on boots

**Silhouette**: Tall and heavy. Tesla coil backpack rises above the head. Ceramic plating widens the torso. At RTS zoom reads as a taller, glowing-brighter version of the base current infantry — more blue, more bulk.

**Colors**: Primary electric blue `#1E90FF` LED strips, arc crackle between coil terminals, electrode glow, visor tint. Secondary white `#E8ECF0` suit body, ceramic plates, gloves, hood. Accent copper exposed coil windings, electrode tips, finger tips, grounding strips.

**Animations**:
- `idle`: Tesla coil arcs between terminals continuously. LED strips pulse. Capacitor banks hum.
- `move`: measured heavy stride, arc cannon at ready. Coil crackle intensifies with movement.
- `attack`: arc cannon fires sustained beam — blue-white arc streams from electrode tips. Tesla coil flares. Heavy recoil.
- `hit`: staggers, ceramic plate shatters. Tesla coil discharges wildly — random arcs. LEDs flicker.
- `death`: Tesla coil overloads — massive blue flash, coil melts. Suit goes dark. Collapses forward, smoke rises.

---

### Tank — Mobile Substation

**File**: `tank_current.glb`

**Subject**: A mobile electrical substation on a heavy tracked chassis. Center of the vehicle is a massive transformer core — cylindrical, wrapped in copper coils, cooling fins radiating outward. Power conduits (thick insulated cables) run from transformer to capacitor banks on either side — orderly rows of cylindrical cells. Tesla coil antenna rises from the top — functional, crackling with ambient arcs. Chassis is clean, well-maintained, sealed against moisture. Blue indicator lights along the hull. This is precision engineering. The most valuable machine in any faction's inventory.

**Visual markers**:
- Central transformer core — large cylinder, visible copper coils, cooling fins
- Capacitor banks on either side — orderly rows of cylindrical cells
- Tesla coil antenna on top — tall, thin, crackling
- Thick insulated power conduits connecting components
- Heavy tracked chassis — clean, sealed, well-maintained
- Blue indicator lights along hull

**Silhouette**: Tall and vertical. Tesla coil antenna dominates height. Transformer core adds central bulk. "Mobile power plant."

**Colors**: Primary electric blue `#1E90FF` indicator lights, Tesla coil glow, capacitor charge indicators. Secondary white `#E8ECF0` chassis panels, transformer housing, cooling fins. Accent navy `#0A0A28` tracks, power conduits, sealed compartments.

**Animations**:
- `idle`: Tesla coil crackles with ambient arcs (vertex pulses). Capacitor banks hum (glow cycle). Cooling fins shimmer.
- `move`: Tesla coil retracts slightly, capacitors dim. Tracks roll smoothly.
- `attack`: Tesla coil charges (glow intensifies 0.3s), discharges massive arc forward. Capacitors flash in sequence. Chassis absorbs recoil cleanly.
- `hit`: capacitor bank sparks, indicators flicker. Panel dents.
- `death`: transformer breaches — blue-white energy cascades outward. Tesla coil snaps. All lights die at once.

---

### Scout — Signal Scout

**File**: `scout_current.glb`

**Subject**: A small hovering drone shaped like a compact relay station. Disc-shaped body with four sealed electric thrust pods (not rotors — no exposed blades). Antenna array on top — three thin whip antennas in a triangle. Sensor lens on the front face (dark glass). Signal repeater dish on the underside. Clean, white, precise — manufactured, not improvised. Blue running lights outline the disc edge. Virtually silent.

**Visual markers**:
- Disc-shaped body — smooth, aerodynamic, sealed
- Four electric thrust pods — compact, clean, sealed
- Triangle antenna array on top — three whip antennas
- Sensor lens on front face — dark glass
- Signal repeater dish on underside
- Blue running lights around disc edge

**Silhouette**: Compact and symmetrical. Disc with antenna spikes on top. Clean, identifiable. "High-tech surveillance."

**Colors**: Primary electric blue `#1E90FF` running lights, thrust pod glow, antenna tips. Secondary white `#E8ECF0` disc body, thrust pod housings, antenna masts. Accent navy `#0A0A28` sensor lens, repeater dish, thrust pod interiors.

**Animations**:
- `idle`: hovers with gentle bob ±2px. Antenna array rotates slowly (scanning). Running lights pulse in sequence.
- `move`: tilts forward 10°, thrust pods intensify (blue glow increases). Antennas lock forward.
- `attack`: sensor lens flashes (targeting pulse), emits focused signal burst. Antennas flare. Slight backward recoil.
- `hit`: wobbles violently, thrust pod flickers. Antenna bends. Overcorrects to recover.
- `death`: thrust pods fail in sequence — drone tilts, spins, drops. Running lights die. Clatters to ground intact but dead.

---

### Scout (Upgraded) — Electric Jellyfish

**File**: `scout2_current.glb`

**Subject**: A giant floating jellyfish the size of a small car, with a rider harnessed underneath. Translucent bell-shaped body — pale blue-white membrane, internal structures faintly visible through the skin. Long trailing tentacles hanging below, crackling with blue electric arcs between them. Bioluminescent blue glow pulsing through the bell. The rider hangs in a harness suspended from the underside of the bell — straps and a simple seat between the tentacles. Rider wears a full insulated suit, thick rubber-coated coveralls with ceramic plate reinforcement at chest and shoulders, sealed hood with a clear visor tinted blue, heavy insulated gloves. Blue LED indicator strips on the suit seams. The jellyfish hovers silently above the ground. No armor — living creature. Hard edge forms on the rider and harness, organic translucent forms on the jellyfish. Surface wear baked into the rider's suit.

**Visual markers**:
- Giant translucent jellyfish — bell-shaped body, pale blue-white membrane
- Trailing tentacles crackling with blue electric arcs
- Bioluminescent blue glow pulsing through the bell
- Rider in insulated suit harnessed underneath
- Blue LED strips on rider's suit, blue visor tint

**Silhouette**: Tall and ethereal. Jellyfish bell dominates the top, tentacles trail below. Rider is a small shape suspended in the middle. At RTS zoom reads as a glowing vertical blob — unmistakable.

**Colors**: Primary electric blue `#1E90FF` bioluminescent glow, arc crackle, LED strips, visor tint. Secondary translucent blue-white jellyfish membrane. Accent white `#E8ECF0` insulated suit body, ceramic plates, harness straps.

**Animations**:
- `idle`: jellyfish bell pulses slowly — contracts and expands. Tentacles drift. Blue glow throbs.
- `move`: bell contracts rhythmically, propelling forward. Tentacles stream behind. Rider sways in harness.
- `attack`: tentacles lash forward, blue arcs intensify. Crackling discharge at the tips.
- `hit`: bell contracts sharply, tentacles flail. Glow flickers. Rider swings in harness.
- `death`: glow dies, bell deflates, tentacles go limp. Whole creature sinks to the ground. Rider drops with it.

---

### Artillery — Arc Cannon

**File**: `artillery_current.glb`

**Subject**: A precision long-range directed-energy weapon. Tall tripod base (three insulated legs, adjustable height) supports a long capacitor array — row of cylindrical cells leading to a focusing barrel. Barrel tip has two parallel electrodes that generate a sustained arc between them before releasing at target. Heavy power cable runs to a portable generator behind the tripod. Control console with blue holographic targeting display (flat panel, blue readout). Modular, clean, precise — a weapon system, not junk.

**Visual markers**:
- Tall adjustable tripod — three insulated legs
- Capacitor array — row of cylinders leading to barrel
- Dual-electrode barrel tip — two parallel prongs with arc gap
- Heavy power cable to portable generator
- Control console — flat panel with blue display
- Modular, clean, engineered

**Silhouette**: Tall and thin. Tripod and barrel create a vertical needle shape. Generator adds secondary mass at base. "Precision long-range weapon" — antenna-like.

**Colors**: Primary electric blue `#1E90FF` arc between electrodes, capacitor glow, display panel, targeting readout. Secondary white `#E8ECF0` barrel housing, tripod legs, capacitor shells, generator casing. Accent navy `#0A0A28` power cable, electrode tips, console frame.

**Animations**:
- `idle`: arc crackles between electrode tips (constant blue pulse). Capacitors glow in sequence (charging cycle). Display glows steady.
- `move`: barrel lowers, tripod legs fold partially. Generator cable coils. Compact travel mode.
- `attack`: capacitors charge in rapid sequence (blue glow cascades), arc intensifies between electrodes, releases forward. Massive blue-white flash. Tripod absorbs recoil through leg shocks.
- `hit`: capacitor cell pops (vertex flash), arc destabilizes (flicker), tripod leg slips.
- `death`: full capacitor overload — blue chain reaction along array. Wild uncontrolled arc. Tripod collapses. Generator shorts out.

---

# World Props (Terrain)

3D objects placed on hex tiles via Three.js. Sit on top of the flat colored hex base rendered in PixiJS. Most are **static** (no animation). Placed 1-4 per hex depending on terrain type, with random rotation and slight position jitter for variety.

---

## Plains Props

Mostly empty hexes. Sparse scatter for subtle texture.

### Dead Grass Tuft
**File**: `prop_dead_grass.glb`
**Subject**: Small cluster of dried, flattened grass blades. 3-5 blades fanning from a single base point. Dried yellow-brown, sparse.
**Colors**: Dried yellow-brown over ashen olive `#6A6A58`.
**Placement**: 0-2 per plains hex, random rotation.
**Animation**: None (static).

### Road Stripe Remnant
**File**: `prop_road_stripe.glb`
**Subject**: Short section of faded white road dashing — single dashed line segment, cracked and barely visible. Flat on ground.
**Colors**: Faded white/pale grey on ashen ground.
**Placement**: 0-1 per plains hex, random rotation.
**Animation**: None (static).

### Scattered Rocks
**File**: `prop_rocks_small.glb`
**Subject**: 3-5 small pebbles and gravel pieces clustered loosely. Fist-sized or smaller.
**Colors**: Slightly lighter/darker variants of `#6A6A58`.
**Placement**: 0-2 per plains hex.
**Animation**: None (static).

### Concrete Pipe Section
**File**: `prop_concrete_pipe.glb`
**Subject**: Short section of large-diameter concrete drainage pipe, half-buried at an angle in the dirt. One end exposed, the other sunk into the ground. Interior dark. Rebar visible at the broken edge. Left behind when the infrastructure build stopped — never connected to anything.
**Colors**: Pale concrete grey, rust-brown rebar, dark interior, ashen ground dust.
**Placement**: 0-1 per plains hex.
**Animation**: None (static).

### Survey Stakes
**File**: `prop_survey_stakes.glb`
**Subject**: Two wooden survey stakes driven into the ground at angles, connected by a sagging line of faded orange ribbon. The stakes mark a construction boundary that was never built. Ribbon sun-bleached and fraying. Stakes weathered grey.
**Colors**: Weathered grey wood, faded orange ribbon, ashen ground.
**Placement**: 0-1 per plains hex.
**Animation**: None (static).

### Abandoned Tire
**File**: `prop_tire.glb`
**Subject**: Single large truck tire lying flat on the ground. Sun-cracked rubber, sidewall text unreadable. Left on an unfinished construction haul route.
**Colors**: Dark grey-black rubber, sun-faded sidewall, dust-caked tread.
**Placement**: 0-1 per plains hex.
**Animation**: None (static).

---

## Forest Props

Dense clusters. 2-4 trees per hex with understory detail.

### Charred Tree (Variant A)
**File**: `prop_tree_a.glb`
**Subject**: Single charred tree — thick trunk, 3-4 major branches. Some bare and blackened, others hold dark green foliage (angular leaf clusters). Stressed, partially burned.
**Colors**: Trunk near-black brown, canopy charred green `#3A4030` with variation. Bare branches dark brown-black.
**Placement**: 2-4 per forest hex, random rotation, Y-scale 0.8-1.2 for height variety.
**Animation**: None (static).

### Charred Tree (Variant B)
**File**: `prop_tree_b.glb`
**Subject**: Thinner, leaning tree. More damaged — mostly bare branches, small foliage cluster at top only. Trunk has a slight bend.
**Colors**: Same palette as variant A.
**Placement**: Mixed with variant A for variety.
**Animation**: None (static).

### Fallen Log
**File**: `prop_fallen_log.glb`
**Subject**: Fallen tree trunk, snapped partway up. Lying at angle on ground. Exposed pale wood at break point, dark bark elsewhere. Moss patches.
**Colors**: Dark grey-brown bark, pale exposed wood, muted dark green moss.
**Placement**: 0-1 per forest hex.
**Animation**: None (static).

### Charred Tree (Variant C)
**File**: `prop_tree_c.glb`
**Subject**: Broad, squat tree — short thick trunk splitting into two main limbs low to the ground. Dense dark canopy spreading wide. One limb bare and blackened, the other still holding foliage. Different silhouette from A and B — wider than tall.
**Colors**: Same palette as variants A and B.
**Placement**: Mixed with variants A and B for variety.
**Animation**: None (static).

### Buried Road Sign
**File**: `prop_road_sign.glb`
**Subject**: Metal road sign half-buried among roots. Tilted at angle, text unreadable, rusted metal post. Square or diamond shape.
**Colors**: Rusted orange-brown sign, faded text, dark metal post.
**Placement**: 0-1 per forest hex. Rare detail.
**Animation**: None (static).

### Overgrown Footing
**File**: `prop_overgrown_footing.glb`
**Subject**: Rectangular concrete foundation block on the forest floor, roots growing over and through cracks in the surface. Rebar stubs poking up from the top — a building was meant to go here. Moss and dark soil caked into the seams. Nature reclaiming construction.
**Colors**: Pale concrete grey with dark moss green, rust-brown rebar, charred green `#3A4030` moss.
**Placement**: 0-1 per forest hex. Rare detail.
**Animation**: None (static).

---

## Mountain Props

Imposing rock formations. 1-2 major rocks per hex.

### Rock Peak (Variant A)
**File**: `prop_rock_peak_a.glb`
**Subject**: Jagged rocky peak — raw stone, sharp angular faces. Fractured geological layers in cross-section. Wind erosion striations. Scree at base.
**Colors**: Dark iron ore `#505058` with lighter/darker facets. Erosion lines lighter grey. Crevice shadows near-black.
**Placement**: 1 per mountain hex, centered.
**Animation**: None (static).

### Rock Peak (Variant B)
**File**: `prop_rock_peak_b.glb`
**Subject**: Two adjacent stone pillars with narrow gap — natural pass or crevice. Deep erosion grooves. Small overhang at base. Loose boulders around formation.
**Colors**: Same palette as variant A, slightly warmer.
**Placement**: 1 per mountain hex. Alternative to variant A.
**Animation**: None (static).

### Loose Boulders
**File**: `prop_boulders.glb`
**Subject**: 2-3 large loose boulders clustered. Angular, broken from larger formation.
**Colors**: Dark grey `#505058` varied tones.
**Placement**: 0-1 per mountain hex, secondary detail.
**Animation**: None (static).

### Abandoned Retaining Wall
**File**: `prop_retaining_wall.glb`
**Subject**: Short section of unfinished concrete retaining wall — poured halfway, construction stopped. Rebar stubs extend upward from the top edge where the next pour was meant to go. Plywood formwork still attached on one side, warped and stained. A road or rail line was meant to cut through this mountainside. It never did.
**Colors**: Raw concrete grey, rust-brown rebar, dark warped plywood, iron ore `#505058` rock face behind.
**Placement**: 0-1 per mountain hex.
**Animation**: None (static).

### Rock Peak (Variant C)
**File**: `prop_rock_peak_c.glb`
**Subject**: Flat-topped mesa formation — wide base tapering to a level plateau. Layered sedimentary bands visible in cross-section. Scree and gravel at the base. Different silhouette from A and B — horizontal cap instead of jagged peak.
**Colors**: Dark iron ore `#505058` with warmer sandstone bands `#6A6050`. Scree lighter grey.
**Placement**: 1 per mountain hex. Alternative to variants A and B.
**Animation**: None (static).

---

## City Props

Dense urban ruin elements. 1-2 structures + 1-2 detail props per hex.

### Building Shell (Variant A — Tall)
**File**: `prop_building_tall.glb`
**Subject**: Multi-story concrete building shell — walls standing, no roof, no windows, just rectangular openings. Exposed rebar at top floors. 3-4 stories. Unfinished, not bombed.
**Colors**: Ember orange-grey `#7A6048` concrete, dark rust brown rebar, near-black window openings.
**Placement**: 0-1 per city hex.
**Animation**: None (static).

### Building Shell (Variant B — Low-Rise)
**File**: `prop_building_low.glb`
**Subject**: Shorter, wider structure — partially built commercial complex, 1-2 stories. Flat concrete roof with exposed beams. Collapsed section showing interior. Faded unreadable sign.
**Colors**: Ember orange-grey `#7A6048`, dark steel grey beams, faded sign.
**Placement**: 0-1 per city hex.
**Animation**: None (static).

### Utility Pole
**File**: `prop_utility_pole.glb`
**Subject**: Broken utility pole, leaning slightly. Electrical cables dangling loose from top. No power.
**Colors**: Dark grey-brown pole, black cables.
**Placement**: 0-1 per city hex.
**Animation**: None (static).

### Road Barrier
**File**: `prop_jersey_barrier.glb`
**Subject**: Concrete jersey barrier. Stained, cracked.
**Colors**: Pale concrete grey, dust and rust stains.
**Placement**: 0-1 per city hex.
**Animation**: None (static).

### Construction Debris
**File**: `prop_debris.glb`
**Subject**: Small pile of construction debris — concrete chunks, twisted rebar, bent metal pipe, cracked cinder block.
**Colors**: Mixed grey and brown, rust accents.
**Placement**: 0-1 per city hex.
**Animation**: None (static).

### Scaffolding Section
**File**: `prop_scaffolding.glb`
**Subject**: Freestanding section of tubular steel scaffolding — two vertical frames connected by cross-braces and a single plank platform at mid-height. Standing alone with nothing attached to it. The building it was meant to support was never finished. One frame leans slightly. Rust at the joint couplers.
**Colors**: Dark steel grey `#505058` tubes, rust-brown at joints, pale grey-brown plank.
**Placement**: 0-1 per city hex.
**Animation**: None (static).

### Dumpster
**File**: `prop_dumpster.glb`
**Subject**: Large industrial dumpster — open-top rectangular steel box on small caster wheels. Lid ajar at an angle. Overflowing with construction waste — concrete chunks, bent rebar stubs, crumpled sheet metal visible above the rim. Exterior paint faded and rust-streaked. A dumpster left on a job site that closed overnight.
**Colors**: Faded dark green paint with rust streaks, grey concrete waste, rust-brown rebar, dark steel.
**Placement**: 0-1 per city hex.
**Animation**: None (static).

### Frozen Crane Arm
**File**: `prop_crane_arm.glb`
**Subject**: The upper section of a tower crane boom lying on the ground — the lattice arm with its trolley still attached, cables dangling. The tower it sat on is gone or collapsed elsewhere. The boom is angled across the ground, partially resting on rubble. A massive piece of infrastructure frozen mid-swing and dropped. Longest prop in the set.
**Colors**: Faded yellow `#C4A840` lattice steel, dark steel cables, rust at pin joints.
**Placement**: 0-1 per city hex. Rare — the largest detail prop.
**Animation**: None (static).

---

## Objective Prop

One unique structure for the central objective hex.

### Command Tower
**File**: `prop_command_tower.glb`
**Subject**: Squat reinforced concrete bunker base with tall antenna array rising from roof. Multiple antenna rods, satellite dish, warning lights (red). Faint amber glow from inside through narrow slit windows — power is on. Thick power cables into ground. Small generator beside bunker. Functional, not ruined — maintained by whoever holds it. The only structure on the map that looks alive.
**Colors**: Concrete grey with ember warmth, dark steel antenna, molten gold `#C88A20` glow and warning lights, black cables, dark steel generator.
**Placement**: 1 per objective hex, centered. Tallest structure on the map.
**Animation**: Warning light blink — antenna tip alternates `#C88A20` ↔ dim `#3A3020` at ~1Hz. Generator vibration — Y-axis oscillation ±0.5px at ~3Hz.

---

## Hex Modifier Props

Props placed on hexes with modifier overlays (river, lake, bridge, highway). These sit on top of the re-colored hex surface.

### Bridge Span
**File**: `prop_bridge_span.glb`
**Subject**: Short section of unfinished concrete bridge deck — two thick support piers rising from below, flat driving surface across the top with rebar stubs where guardrails were meant to go. One lane wide. The pour stopped mid-span — rough concrete edge on one side shows the formwork was never removed. Construction cones still sitting on the deck. A bridge to nowhere that happens to cross a river.
**Colors**: Raw concrete grey `#8A8880`, rust-brown rebar stubs, dark grey `#505058` support piers, faded orange cones.
**Placement**: 1 per bridge hex, centered. Oriented perpendicular to river flow direction.
**Animation**: None (static).

### Highway Guardrail
**File**: `prop_road_guardrail.glb`
**Subject**: Bent W-beam highway guardrail on wooden posts — a short section, 3-4 posts long. One post snapped off at the base, the rail section drooping and twisted at that end. Reflector tabs still attached but dulled. A chunk of highway safety infrastructure left standing on an unfinished road.
**Colors**: Dull galvanized silver `#A0A098` rail, dark wood `#4A3828` posts, faded red-orange reflector tabs.
**Placement**: 0-1 per highway hex, offset to hex edge.
**Animation**: None (static).

### Water Reeds
**File**: `prop_water_reeds.glb`
**Subject**: Clump of cattails and marsh reeds growing from shallow water — 4-6 tall stalks with characteristic brown seed heads at the top, thinner green-brown reeds around the base. Slightly wind-bent. Nature reclaiming the edges of stagnant water.
**Colors**: Olive-brown stalks `#5A5838`, dark brown `#4A3020` seed heads, murky green-brown base.
**Placement**: 0-2 per river or lake hex, offset toward hex edges.
**Animation**: None (static).

### Waterlogged Debris
**File**: `prop_water_debris.glb`
**Subject**: Half-submerged construction waste in still water — a tire lying flat with water filling the center, a wooden plank floating at an angle, a bent piece of corrugated sheet metal sticking out. The kind of garbage that accumulates in urban waterways. Partially visible above a flat water plane.
**Colors**: Black rubber tire, grey-brown plank, rust-orange corrugated metal, dark water base `#2A3040`.
**Placement**: 0-1 per river or lake hex.
**Animation**: None (static).

---

# HUD Icons (2D Pixel Art)

4 icons for the shop/unit info panel. **Not 3D** — flat PNGs, tinted at runtime via `sprite.tint`.

All icons: 32x32px, white `#FFFFFF` filled silhouette on transparent background, crisp pixel edges, no anti-aliasing, centered with 1-2px padding.

Tinted per faction at runtime:
| Faction | Tint |
|---------|------|
| Engineers | `#F2C94C` |
| Caravaners | `#D4845A` |
| Los Pistoleros | `#FF6B00` |
| Wardens | `#FF6B00` |
| Scrappers | `#A0522D` |
| The Current | `#1E90FF` |

### Infantry Icon
**File**: `icon_infantry.png`
**Subject**: Standing soldier silhouette. Slight forward lean. Backpack on back. One arm holds weapon upward. Helmet on head. Stable stance.

### Tank Icon
**File**: `icon_tank.png`
**Subject**: Tracked armored vehicle, 3/4 isometric angle. Hull, turret on top, barrel forward. Wide tracked base.

### Scout Icon
**File**: `icon_scout.png`
**Subject**: Small, fast unit. Compact shape suggesting speed. Noticeably smaller within the 32x32 frame than tank or infantry.

### Artillery Icon
**File**: `icon_artillery.png`
**Subject**: Long-range weapon platform. Base/chassis with long barrel at 30-45° upward angle. Stabilizer legs at base.

---

# Effect Sprites (2D)

### Damage Number Font
**File**: `damage_font.png` — sprite sheet, ~176x16px
**Characters**: `-0123456789`, each 16x16 cell.
**Style**: Bold chunky pixel font. Bright red `#FF3333` with dark red `#880000` shadow (1px bottom-right). Monospaced. Crisp pixel edges.

### Explosion / Death Marker
**File**: `explosion.png` — 64x64px
**Subject**: Stylized explosion burst — bright core, jagged rays, debris particles, smoke wisps. Graphic/iconic, flat shaded.
**Colors**: Molten gold `#C88A20` core, orange-red rays, dark grey debris, semi-transparent smoke.

---

# File Manifest

## Unit GLBs (24 files, each with 5 animation clips)
```
assets/models/units/infantry_engineer.glb
assets/models/units/tank_engineer.glb
assets/models/units/scout_engineer.glb
assets/models/units/artillery_engineer.glb
assets/models/units/infantry_caravaner.glb
assets/models/units/tank_caravaner.glb
assets/models/units/scout_caravaner.glb
assets/models/units/artillery_caravaner.glb
assets/models/units/infantry_pistolero.glb
assets/models/units/tank_pistolero.glb
assets/models/units/scout_pistolero.glb
assets/models/units/artillery_pistolero.glb
assets/models/units/infantry_warden.glb
assets/models/units/tank_warden.glb
assets/models/units/scout_warden.glb
assets/models/units/artillery_warden.glb
assets/models/units/infantry_greaser.glb
assets/models/units/tank_greaser.glb
assets/models/units/scout_greaser.glb
assets/models/units/artillery_greaser.glb
assets/models/units/infantry_current.glb
assets/models/units/tank_current.glb
assets/models/units/scout_current.glb
assets/models/units/artillery_current.glb
```

## World Prop GLBs (29 files, mostly static)
```
assets/models/props/prop_dead_grass.glb
assets/models/props/prop_road_stripe.glb
assets/models/props/prop_rocks_small.glb
assets/models/props/prop_concrete_pipe.glb
assets/models/props/prop_survey_stakes.glb
assets/models/props/prop_tire.glb
assets/models/props/prop_tree_a.glb
assets/models/props/prop_tree_b.glb
assets/models/props/prop_tree_c.glb
assets/models/props/prop_fallen_log.glb
assets/models/props/prop_road_sign.glb
assets/models/props/prop_overgrown_footing.glb
assets/models/props/prop_rock_peak_a.glb
assets/models/props/prop_rock_peak_b.glb
assets/models/props/prop_rock_peak_c.glb
assets/models/props/prop_boulders.glb
assets/models/props/prop_retaining_wall.glb
assets/models/props/prop_building_tall.glb
assets/models/props/prop_building_low.glb
assets/models/props/prop_utility_pole.glb
assets/models/props/prop_jersey_barrier.glb
assets/models/props/prop_debris.glb
assets/models/props/prop_scaffolding.glb
assets/models/props/prop_dumpster.glb
assets/models/props/prop_crane_arm.glb
assets/models/props/prop_command_tower.glb
assets/models/props/prop_bridge_span.glb
assets/models/props/prop_road_guardrail.glb
assets/models/props/prop_water_reeds.glb
assets/models/props/prop_water_debris.glb
```

## 2D Assets (6 files)
```
assets/icons/icon_infantry.png
assets/icons/icon_tank.png
assets/icons/icon_scout.png
assets/icons/icon_artillery.png
assets/effects/damage_font.png
assets/effects/explosion.png
```

## Prop Placement Rules

| Terrain | Major props | Detail props | Total per hex |
|---------|------------|--------------|---------------|
| Plains | — | 0-2 (grass, rocks, road stripe, concrete pipe, survey stakes, tire) | 0-2 |
| Forest | 2-4 trees (mix A/B/C) | 0-1 (fallen log, road sign, overgrown footing) | 2-5 |
| Mountain | 1 rock peak (A, B, or C) | 0-1 (boulders, retaining wall) | 1-2 |
| City | 1 building (tall or low) | 1-2 (utility pole, barrier, debris, scaffolding, dumpster, crane arm) | 2-3 |
| Objective | 1 command tower | — | 1 |

### Modifier Overlay Props

Modifier props are placed **instead of** terrain props on hexes with a modifier. The hex surface color changes too (handled by terrain-renderer).

| Modifier | Props | Surface color |
|----------|-------|---------------|
| River | 0-2 water reeds, 0-1 waterlogged debris | Dark water `#2A3040` |
| Lake | 0-2 water reeds, 0-1 waterlogged debris | Dark water `#2A3040` |
| Bridge | 1 bridge span | Terrain color (unchanged) |
| Highway | 0-1 road guardrail (terrain detail props still allowed at reduced rate) | Asphalt dark `#3A3A38` |
