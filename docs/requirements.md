# Game Boy Tetris (1989) Clone: Requirements

**Status:** Decision-complete. Open questions: none.
**Date:** 2026-10-15
**Scope:** Requirements only. No implementation.

Items tagged *(default)* were not discussed with the owner. They are low risk. Change them if wrong.

---

## 1. Problem and desired outcome

Build a single offline HTML file that plays Game Boy Tetris (1989, A-Type) inside a drawn Game Boy. It matches the original look and rules. It adds only three things: 10 saved high scores, a music toggle and remappable keys. It is for private use.

---

## 2. Confirmed requirements

### 2.1 Delivery
- One standalone HTML file. No server, no external files, no network calls.
- Railway hosting is not used.
- All assets are inline. Art is redrawn in code. Music is synthesized with Web Audio.

### 2.2 Screen flow
- **Title:** TETRIS logo, artwork, **1 PLAYER** only, and the ©1989 Nintendo line.
- **Level select (A-TYPE):** levels 0 to 9. TOP-SCORE panel shows the top 3.
- **Play:** SCORE, LEVEL, LINES, next-piece box, brick walls (per screenshots).
- **Game over:** name entry if the score qualifies, then back to the title *(default)*.
- **Title hotkeys (fixed, no menu items):**
  - **H** opens the Top 10 screen.
  - **K** opens the Keys screen.

### 2.3 Gameplay (exact 1989 rules)
- Playfield is 10 wide and 18 tall. One next piece is shown. No hold. No hard drop.
- Rotation is the left-handed Nintendo Rotation System. No wall kicks. A blocked rotation is refused. Only clockwise rotation exists (one rotate action).
- Start levels are 0 to 9. The first level-up comes at start level × 10 + 10 lines. After that, a level-up comes every 10 lines. Maximum level is 20.
- A clear scores 40, 100, 300 or 1,200 × (level + 1). The level used is the one before the clear. Score stops at 999,999. Soft drop adds points per the disassembly. The level does not multiply them.
- Gravity in frames per row, levels 0 to 20:

  | Level | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | Frames | 53 | 49 | 45 | 41 | 37 | 33 | 28 | 22 | 17 | 11 | 10 |

  | Level | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
  |---|---|---|---|---|---|---|---|---|---|
  | Frames | 9 | 8 | 7 | 6 | 6 | 5 | 5 | 4 | 4 | 3 |

  Frame rate is 59.73 per second. Run the game logic on a fixed timestep.
- Soft drop moves the piece one row every 3 frames.
- Held left or right moves at once, repeats after 23 frames, then every 9 frames. One wiki lists 24. Use 23 (from the ROM disassembly).
- Randomizer (biased, as in the original):
  - Piece IDs: L0 J1 I2 O3 Z4 S5 T6.
  - Keep 3 pieces queued: current, preview and hidden.
  - A new hidden piece gets up to 3 rolls. On rolls 1 and 2, reroll if (candidate OR preview OR current) equals current. Roll 3 is kept.
  - Test target shares: L about 10.7%, J, I and Z about 13.7%, O, S and T about 16.1%.
- Top-out: the second piece that locks in its spawn position ends the game.
- For any number not listed here, the authority is the MIT-licensed `vinheim3/tetris-gb-disasm` disassembly.

### 2.4 Controls
- Six remappable actions: left, right, down, rotate, start/pause, music.
- Defaults:

  | Action | Default key |
  |---|---|
  | Left | Left arrow |
  | Right | Right arrow |
  | Down (soft drop) | Down arrow |
  | Rotate clockwise | Up arrow |
  | Start / pause | Enter |
  | Music toggle | M |

- Menus and name entry use the bound keys. The rotate key acts as "up" *(default)*.
- Bindings are saved in localStorage.
- Keyboard only.

### 2.5 High scores
- Top 10, saved in localStorage. Each entry has a name and a score.
- Name entry: up to 6 characters, original style.
  - Up and Down change the character.
  - Left and Right move the cursor.
  - Start confirms.
- Level screen shows the top 3. The Top 10 screen shows all 10.
- Empty rows show dotted lines, as in the screenshot.

### 2.6 Audio
- Music only. Style is 8-bit and loops.
- Music is an original synthesized arrangement of the folk tune Korobeiniki, which the 1.1 cartridge uses.
- Music plays during play. It pauses on pause and stops on game over. The title is silent *(default)*.
- The toggle works on every screen. Its state is saved.
- Audio starts after the first keypress, because browsers block autoplay.

### 2.7 Look
- Logical screen is 160×144 pixels. Scaling is pixel-sharp.
- Four shades sampled from the supplied screenshots.
- Tile patterns, brick walls and side panel match the screenshots.
- A Game Boy body drawn in CSS or SVG surrounds the screen. Labels A, B, Start and Select are visible but decorative. Classic gray body *(default)*.
- The whole device scales to fit the window and keeps its aspect ratio. No scrollbars.

---

## 3. Preferences and examples (not requirements)
- "Classic 8-bit music" sets style only. It does not set an exact tune or notes.
- The screenshots are visual references. Pixel-exact layout is not required.
- "Basic color" is read as the four screenshot shades. Shell colors are an implementer choice.

---

## 4. Non-goals
- B-Type, 2 PLAYER, heart mode, rocket and dancer endings, preview hide with Select.
- Sound effects.
- Counterclockwise rotation.
- Touch input and clickable shell buttons.
- A manual size control.
- Shared or server-side scores.
- Start levels above 9.

---

## 5. Edge cases and failure behavior
- **Storage unavailable or corrupt:** the game still runs. Scores and keys fall back to defaults in memory. A small notice outside the screen says "Scores not saved" *(default)*.
- **Scope of saved data:** scores and keys are tied to the browser profile and file location. Clearing site data erases them.
- **Remap rules** *(default)*:
  - Duplicate keys are rejected. The old binding stays.
  - Reserved keys: H, K, Esc and any key with a modifier.
  - The Keys screen always navigates with fixed arrows, Enter and Esc.
  - The Keys screen has a "reset to defaults" row. This prevents lockout.
- **Qualifying score:** above 0, and either fewer than 10 entries or above the 10th score. Ties rank below older equal scores *(default)*.
- **Tab hidden or window blur:** game and music pause *(default)*.
- **OS key repeat events are ignored.** Hold timing follows the frame counters.
- **Legend outside the screen** shows H, K, current bindings and music state *(default)*.

---

## 6. Confirmed constraints
- Title, ©1989 Nintendo notice and Game Boy shell stay as in the screenshots. Private use only. Revisit before any public sharing.
- Target: modern evergreen desktop browser. Chrome is primary.

---

## 7. Deferred ideas
- Sound effects.
- B-Type mode.
- Endings (rocket and dancers).
- Touch controls.
- Manual size control.
- Server-side scores.
- Neutral title and no Nintendo notice for public release.

---

## 8. Open questions
None.

---

## Sources
- `vinheim3/tetris-gb-disasm` (commented ROM disassembly): https://github.com/vinheim3/tetris-gb-disasm
- tetris.wiki, Tetris (Game Boy): https://tetris.wiki/Tetris_(Game_Boy)
- Hard Drop wiki, Tetris (Game Boy): https://harddrop.com/wiki/Tetris_(Game_Boy)
- Summary of the above: https://gamertagmythras.com/blog/tetris/tetris-game-boy-explained
