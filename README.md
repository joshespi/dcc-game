# Dungeon Crawler Carl — Fan Game

> **Fan project. All rights to the *Dungeon Crawler Carl* universe belong to Matt Dinniman.**
> This is a non-commercial labor of love by fans of the book series. No affiliation with the author or publisher. If you haven't read the books, go read them — they're incredible.

A browser-based dungeon crawler inspired by the *Dungeon Crawler Carl* book series.
All assets are generated at runtime — no image files required.

Deployed at [https://dcc.joshespi.com](dcc.joshespi.com)

## Running locally

```bash
cd /home/joshe/dcc-game
python3 -m http.server 8090
```

Open [http://localhost:8090](http://localhost:8090) in your browser.

> Phaser loads scripts via XHR — `file://` won't work, a local HTTP server is required.


## Controls

| Key | Action |
|-----|--------|
| WASD / Arrow keys | Move |
| SPACE | Punch / Kick (alternates; kick does 1.3× damage + more knockback) |
| Q | Donut casts Magic Missile |
| E | Open loot box · Use potion |
| 1–0 | Use hotlist slot (potions auto-assign; press H in inventory to re-fill) |
| I | Toggle inventory |

## Current state: Floor 1 — The Meadows

The game is currently focused on Floor 1. The map is a grid of wide arteries with city-block neighborhoods and maze-like alleyways between them — matching the book's description of the First Floor as a network of tunnels organized in a giant square grid. Safe rooms (warm-lit floor tiles) appear at artery intersections.

Stairs to Floor 2 are not yet implemented. In the lore, stairwells don't open until ~30 hours after the dungeon seals.

## Floor 1 enemies

| Enemy | Notes |
|-------|-------|
| Rat | Fast, weak, infests every neighborhood |
| Goblin | Standard melee, aware the dungeon is a construct |
| Fairy | Ranged projectiles (pink missiles) |
| Crack Camel | Slow, hits hard |

## Items

Weapons and armor **auto-equip** if better than current gear.
Potions go into your bag — press **E** (when not near a loot box) to drink one.
Open the **I** inventory screen to see equipped gear, all six stats, and Donut's details.

Loot box item names vary by floor depth. Early floors drop improvised weapons (Shiv, Pipe, Broken Bottle); later floors will surface heavier gear.

## Stats (DCC-accurate)

| Stat | Effect |
| --- | --- |
| STR | Melee damage |
| CON | HP on level-up, potion effectiveness |
| DEX | Move speed |
| INT | Spell power, passive regen |
| CHA | Donut bond — improves spell power and regen |
| LUCK | Future use |

## Tech

- [Phaser 3](https://phaser.io/) via CDN — no install needed
- All sprites drawn with HTML5 Canvas at startup
- No build step, no bundler
