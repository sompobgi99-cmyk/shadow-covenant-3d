# Shadow Covenant 3D - Current Game Report

Updated: 2026-07-04

## Status

Shadow Covenant 3D is now a multi-map gothic action-survivor game with online ranking, guest/Google entry flow, unlock progression, difficulty selection, pact modifiers, pets, codex pages, challenge rooms, generated sprites, and mobile support.

Recent local verification passed with:

- `npm run verify`
- Desktop smoke test with Oathbone
- Mobile select/game smoke test
- Challenge Room smoke test
- Map 2 and Map 3 transition smoke test

## Current Flow

1. Choose Guest or Google.
2. Enter player name/country.
3. Choose character.
4. Choose difficulty: Casual, Normal, or Hard.
5. After clearing Map 3 on Normal or Hard, choose Pact modifiers unlocked for that difficulty tier.
6. Clear bosses, claim relics, use portals, and progress through maps.

Casual is for practice and should not submit online ranking scores. Normal is the default experience. Hard enables harsher enemy pressure and is aimed at score runs.

## Playable Characters

The internal key for Oathbone is still `templar` for save/unlock compatibility.

| Character | Start Weapon | Current Role |
|---|---|---|
| Paladin | Shield Toss | Armor-focused holy tank |
| Ranger | Hunter's Arrow | Fast ranged starter |
| Sorceress | Nova Burst | Fragile AoE caster |
| Oathbone | Orbiting Skull | Bone-oath tank with skull guard |
| Huntress | Hex Spread | Attack-speed ranged build |
| Slayer | Blade Wave | Melee damage specialist |
| Priestess | Holy Smite | Sustain holy caster |
| Stormcaller | Lightning Strike | Crit-damage lightning caster |
| Assassin | Throwing Knives | Crit and evade dagger build |
| Necromancer | Soul Spiral | XP/soul scaling caster |
| IT Support | Multi-Tool Screwdriver | Piercing melee utility hero |
| Striker | Cursed Football | Ricochet projectile hero |

## Oathbone Notes

- Display name: Oathbone
- Internal key: `templar`
- Sprite files remain `char_templar_*` for compatibility.
- Current base stats are overridden in runtime to HP 116, SPD 5.0, DEF 8, and rate multiplier 1.08.
- Passive: Damage +1%, max HP +4 per level.
- Starting weapon: Orbiting Skull.
- Portrait is normalized to the same select-card frame as other characters.
- Runtime visual scale has a small sheet-specific override so the body reads closer to other heroes in-game.

## Weapons And Evolutions

The game currently has 30 weapons in audit. Core weapon groups include:

- Melee or close-range: Blade Wave, Orbiting Skull, Multi-Tool Screwdriver, Shield Toss-style close control.
- Ranged/projectile: Hunter's Arrow, Throwing Knives, Lightning Strike, Holy Smite, Hex Spread.
- AoE/control: Nova Burst, Soul Spiral, Bouncing Bomb, ricochet weapons.

Several weapons support evolved forms and separate evolved icons. Ricochet support exists for selected weapons such as Football, Shield Toss, Bone Boomerang, and Bouncing Bomb.

## Enemies, Bosses, And Maps

Current audit reports:

- 33 enemies
- 6 minibosses
- 5 bosses
- 385 manifest assets
- 405 PNG sprites, about 11.84 MB

Maps:

- Map 1: Bleakfield-style starting field.
- Map 2: Crimson/red themed stage with more objects and breakables.
- Map 3: Final boss map, immediately focused on THE OVERLORD.

Map 2 and Map 3 enemies/bosses have higher HP scaling. Map 3 has a boss deadline condition.

## Challenge Rooms

Challenge Rooms are active and use generated doors, floors, props, and room visuals.

Room concepts include:

- Treasure Vault
- Cursed Shrine Room
- Butcher Arena
- Soul Trial
- Merchant Trap

Smoke testing confirmed Challenge Room entry can start without console errors.

## Online And Progression

Systems present:

- Guest mode
- Google login mode
- Online leaderboard path through Netlify/Supabase config
- Achievement unlocks in localStorage
- Cloud progress sync path for Google users
- Soul Coins and pet ownership
- Pact unlocks are split by difficulty: Normal clears unlock Normal Pact, Hard clears unlock Hard Pact

Local dev server can play the game, but full online progress sync should be verified on Netlify because the local server intentionally does not provide full player-progress sync.

## Mobile

Mobile controls include joystick, DASH, F, and HUD compact controls. The current mobile-control gate requires touch support plus a mobile-sized viewport, so desktop Chrome devices that report touch capability do not show mobile buttons on large screens.

## Known Follow-Up Checks

- Test Google login with a real account on the Netlify URL after deploy.
- Play one full Normal run and one Hard run manually for balance feel.
- Play each Challenge Room long enough to judge reward fairness.
- Recheck Codex pages after large content changes.
- Keep generated test screenshots out of commits unless they are intentionally used as QA evidence.
