# Shadow Covenant Code Map

- `index.html`: Game markup and script loading order.
- `css/game.css`: All interface and responsive styles.
- `js/game-data.js`: Asset manifest, enemies, bosses, and item definitions.
- `js/audio.js`: Procedural Web Audio sound effects.
- `js/combat.js`: Weapon configuration, upgrades, and firing behavior.
- `js/game-runtime.js`: Shared state, renderer setup, entities, world construction, and menus.
- `js/game-loop.js`: Per-frame simulation, movement, collision, projectiles, waves, and spatial grid.
- `js/game-systems.js`: Effects, drops, bosses, interactables, skills, camera, HUD, and restart flow.

Run `npm run check` after editing JavaScript. The files use classic browser scripts and share
top-level game state, so keep their order in `index.html`.

## Performance Notes

Enemy proximity uses a spatial grid rebuilt during simulation. New collision or area checks
should use `forEachNearbyEnemy()` instead of scanning the entire `enemies` array when possible.
HUD text is intentionally refreshed at 10 Hz while animated damage numbers remain frame-based.
