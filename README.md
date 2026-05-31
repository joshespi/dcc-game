# Dungeon Crawler Carl — Fan Game

> **Fan project. All rights to the *Dungeon Crawler Carl* universe belong to Matt Dinniman.**
> This is a non-commercial labor of love by fans of the book series. No affiliation with the author or publisher. If you haven't read the books, go read them — they're incredible.

A browser-based dungeon crawler inspired by the *Dungeon Crawler Carl* book series.
All assets are generated at runtime — no image files required.

Deployed at [https://dcc.joshespi.com](https://dcc.joshespi.com)

## Running locally

```bash
cd /home/joshe/dcc-game
python3 -m http.server 8090
```

Open [http://localhost:8090](http://localhost:8090) in your browser.

> Phaser loads scripts via XHR — `file://` won't work, a local HTTP server is required.

## Controls

| Key | Action |
| --- | ------ |
| WASD / Arrow keys | Move |
| SPACE | Punch / Kick (alternates; kick does 1.3× damage + more knockback) |
| Q | Donut casts Magic Missile in your facing direction |
| R | Donut casts Healing Surge (costs MP) |
| E | Open loot box · Loot corpse · Use stairs · Drink potion |
| T | Use first consumable in hotlist (Smoke Bomb, Distraction Lure, etc.) |
| 1–0 | Use hotlist slot (potions auto-assign; reassign via inventory) |
| I | Toggle inventory (tabs: All / Gear / Consumables / Crafting) |
| K | Skills panel |
| C | Craft selected recipe (when Crafting tab is open) |
| Esc | Close panel |

E priority when multiple prompts overlap: stairs → loot box → corpse → merchant → potion.

## Current state: Floors 1–4

### Floor 1 enemies

| Enemy | Notes |
| ----- | ----- |
| Rat | Fast, weak, infests every neighborhood. Nearby rats aggro when one is attacked. |
| Goblin | Standard melee. |
| Fairy | Ranged pink missiles. Drops rare crafting mats. |
| Crack Camel | Slow, hits hard. |
| Rot Sticker | Inflicts poison on hit. |
| The Hoarder | Neighborhood boss — guards a sealed door. Drops a named legendary item. |

### Floor 2 enemies

| Enemy | Notes |
| ----- | ----- |
| Skeleton | 25% chance to block incoming hits. |
| Danger Dingo | Fast melee, charges. |
| Brindle Grub | Harmless worm — but eats nearby corpses and splits on kill. |
| Goblin / Rat / Fairy | Carry over from Floor 1 with stat scaling. |

### Floor 3 induction — race & class

Descending from Floor 2 opens the **production trailer**: pick a race, then a class.
Both apply permanent stat changes, and your class grants stat points to spend in any
safe room (press **I**). Chosen once per crawler.

- **Races:** Human (balanced), Crocodilian (+STR/CON, −DEX), Sylph (+DEX/INT, −CON), Dvergr (+CON/STR, −DEX). The pool is themed per season.
- **Classes:** each has a stat profile **and a signature perk** — Boring Ol' Fighter (+18% melee), Mage (+25% spell power, spells cost ~half MP), Rogue (+12% crit), Bard (+80% follower gain, recommended), Cleric (+35% healing).

**The Over City (Floor 3):** its own steel-and-glass-tower visual theme, a tougher urban mob mix (skeletons, danger dingoes, kobold riders, clurichauns, mind horrors), and a fresh Krakaren as the neighborhood boss — lore-consistent, since killing one only makes more.

**The Iron Tangle (Floor 4):** rusted-iron industrial theme and the roster's toughest mob mix (bad llamas, trog virtuosos, laminak elites, mind horrors). Boss currently reuses the Krakaren with a deeper-floor intro.

## Items & loot

Weapons and armor **auto-equip** if better than current gear.
Potions and consumables auto-fill your hotlist.

Loot boxes come in six tiers: Bronze → Silver → Gold → Platinum → Legendary → Celestial.
The Hoarder always drops a Legendary box. Killing the boss while near death awards a Survivor's Box.

### Crafting

Enemies drop crafting materials. Open inventory → Crafting tab to see available recipes.

| Recipe | Materials | Output |
| ------ | --------- | ------ |
| Crude Bandage | 2× Rat Skin | Heals 25 HP |
| Shiv | 3× Goblin Tooth | +4 damage weapon |
| Crude Armor Patch | 1× Rot Sticker Carapace + 1× Goblin Ear | +2 defense armor |
| Smoke Bomb | 2× Fairy Dust | Stuns nearby enemies 2s |
| Distraction Lure | 2× Fairy Wing + 1× Rat Tail | Pulls enemy aggro 3s |

## Stats (DCC-accurate)

| Stat | Effect |
| ---- | ------ |
| STR | Melee damage |
| CON | Max HP on level-up, potion heal amount |
| DEX | Move speed |
| INT | Spell power, MP pool, passive MP regen |
| CHA | Donut bond — improves passive healing tick rate and heal amount |
| LUCK | Crit chance (2% per point), dodge chance (1% per point) |

Stat points bank on level-up and are spent manually in safe rooms (Floor 3+).

## Skills

Skills level up through use — no skill points to allocate.

| Skill | Trains by | Effect |
| ----- | --------- | ------ |
| Unarmed Combat | Hitting / killing without a weapon | +1 damage per level |
| Melee | Hitting / killing with a weapon | +1 damage per level |
| Endurance | Taking damage | +3 max HP per level |
| Dodge | Dodging hits | +2% dodge chance per level |

Max level 15. Press **K** to see current levels and XP progress.

## Tech

- [Phaser 3](https://phaser.io/) via CDN — no install needed
- All sprites drawn with HTML5 Canvas at startup
- No build step, no bundler
