# Space Invaders and Pong (Black and White Arcade Remakes): Requirements

**Status:** Decision-complete. Open questions: none.
**Date:** 2026-10-16
**Scope:** Requirements only. No implementation.

Items tagged *(default)* were not discussed with the owner. They are low risk. Change them if wrong.

---

## 1. Problem and desired outcome

Build two separate standalone HTML files:
- `space-invaders.html`: the 1978 arcade game, one player.
- `pong.html`: the 1972 arcade game, one player against a CPU.

Each file plays the original rules in a pure black and white arcade look. Each adds only what the owner asked for: a sound on/off toggle and a Top 10 with 3-initial name entry. Private use.

---

## 2. Shared requirements (both games)

| ID | Requirement |
|---|---|
| S1 | Two separate single HTML files. Each runs offline with no server, no external files and no network calls. Railway is not used. |
| S2 | Look: pure black and white (white on black). No shell, no gray shades, no color overlay. |
| S3 | The game screen fits the window. It keeps its aspect ratio and uses pixel-sharp scaling. Extra window space is black. No scrollbars. Space Invaders is portrait (224×256 logical). Pong is landscape 4:3. |
| S4 | Controls are fixed. There is no remap screen. Keyboard only. Enter starts and pauses. M toggles sound. OS key repeat is ignored. Ctrl, Alt and Meta combinations are ignored *(default)*. |
| S5 | Sound is original-style effects only. All sound is synthesized. There is no music. M toggles all sound on and off. The state is saved. Audio starts after the first keypress. |
| S6 | Each game has its own Top 10, saved in localStorage. Each entry has 3 initials and a score. |
| S7 | Name entry uses 3 slots with letters A to Z *(default)*. Each slot starts at A. Enter accepts the letter and moves to the next slot. After slot 3 the score is saved. The keys that change the letter are listed per game. |
| S8 | A score qualifies when it is above 0 and either fewer than 10 entries exist or it beats the 10th. Ties rank below older equal scores. |
| S9 | Each game shows the Top 10 on its title screen. There is no Top 10 hotkey. |
| S10 | If storage is unavailable or corrupt, the game still runs. Scores and the sound setting fall back to defaults in memory. A "Scores not saved" notice shows. |
| S11 | A hidden tab or a window blur pauses the game and its sound. |
| S12 | A footer strip below the game screen shows the keys, the sound state (ON or OFF) and the storage notice. It is outside the game screen *(default)*. |
| S13 | Browser target: modern evergreen desktop browser. Chrome is primary. |
| S14 | Private use only. Original titles and copyright lines stay *(default)*. |

---

## 3. Space Invaders (1978 arcade, one player)

### 3.1 Flow
- **Attract loop** (title screen), repeating, with a blinking "PRESS ENTER":
  1. Title ("PLAY", "SPACE INVADERS").
  2. Score advance table (mystery ship and the three invader point values).
  3. Top 10 list.
  Each screen shows for about 6 to 8 seconds *(default)*.
- Enter starts a one-player game.
- Game over shows a banner for 3 seconds *(default)*. Then name entry if the score qualifies, then the attract loop.

### 3.2 Controls
- Left and Right arrows move the cannon.
- Space bar fires. Whether holding Space re-fires follows the ROM.
- Enter starts and pauses. M toggles sound.
- Name entry: Left and Right change the letter. Enter accepts.

### 3.3 Rules (exact 1978 arcade rules and timings)

| ID | Requirement |
|---|---|
| I1 | Screen is 224 wide and 256 tall. The invader fleet is 5 rows of 11 (55 invaders). |
| I2 | Points per invader: top row 30, middle two rows 20, bottom two rows 10. |
| I3 | The player has 3 lives. One extra life is awarded at 1,500 points. |
| I4 | The fleet speeds up as invaders are destroyed. Movement and redraw timing follow the ROM. |
| I5 | The player fires one shot at a time. |
| I6 | Invaders fire 3 shot types: rolling, plunger and squiggly. The rolling shot targets the column above the player. The other two follow column-order tables. Shot reload rate depends on the score in 5 brackets. All values follow the ROM. |
| I7 | A mystery ship (UFO) crosses the top at intervals set by the ROM. Its score comes from a 15-entry table selected by the player's shot count: 100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100. The exact counting rule follows the ROM. |
| I8 | Four shields protect the player. Shots from both sides erode them. |
| I9 | A destroyed fleet starts a new wave. The fleet starts lower each wave. Start heights for waves 1 to 8 (rotated-screen coordinates from secondary notes): 112, 128, 144, 152, 160, 160, 160, 160. Later waves stay at 160. **Amended 2026-10-17 (owner decision O2 in `docs/arcade-build-plan.md`):** these values came from secondary notes and disagree with the ROM. Use ROM table 1DA3 instead: rack 1 Yr 0x78, racks 2 to 9 Yr `60 50 48 48 48 40 40 40`, then repeat from rack 2. |
| I10 | The game ends when the player loses the last life or when the invaders reach the bottom. |
| I11 | HUD: SCORE (4 digits), HI-SCORE (the first Top 10 entry, or 0000 when empty), lives count with ship icons *(default)*. The score caps at 9,999 *(default)*. |
| I12 | Sound effects: 4-note fleet march (tempo follows fleet speed), player shot, invader hit, player explosion, UFO sound, UFO hit. |
| I13 | For any number not listed here, the authority is the Space Invaders ROM disassembly by Mikael Agren (Computer Archeology). |

Approximate check values from secondary notes (ROM governs): player shot about 240 px/s, alien shots about 80 px/s.

---

## 4. Pong (1972 Atari, one player against the CPU)

### 4.1 Flow
- **Title screen:** "PONG", a difficulty selector (EASY, NORMAL, HARD) and the Top 10. Up and Down change the difficulty. Normal is selected on each load *(default)*. Enter starts.
- A match is played to 11 points.
- When a side reaches 11, the final score stays on screen for 3 seconds *(default)*. If the player won and the margin qualifies, name entry follows. Then back to the title.

### 4.2 Controls
- Up and Down arrows move the player paddle (left side).
- Enter starts and pauses. M toggles sound.
- Name entry: Up and Down change the letter. Enter accepts.

### 4.3 Rules (exact original Atari Pong behavior)

| ID | Requirement |
|---|---|
| P1 | 4:3 playfield. Player paddle on the left. CPU paddle on the right. Paddles move vertically only. Dashed center line. Large score digits at the top. **Amended 2026-10-17 (owner decision O3 in `docs/arcade-build-plan.md`):** the player paddle is on the right and the CPU paddle on the left. |
| P2 | First side to 11 points wins. There is no win-by-two. A point is scored when the other side fails to return the ball. |
| P3 | Each paddle has 8 segments. The segment hit sets the ball's return angle. The center segments return the ball straight back. The outer segments return it at steeper angles. The circuit gives 7 vertical velocities. |
| P4 | The ball speeds up the longer a rally lasts. Horizontal speed rises after 4 hits and again after 12 hits. A miss resets the speed. |
| P5 | Paddles cannot reach the top strip of the screen. This matches the original circuit. |
| P6 | After a point, the ball is served toward the side that just missed. Details follow the original schematic. |
| P7 | Sound effects: paddle hit, wall hit and point scored (three simple tones). |
| P8 | For any number not listed here, the authority is the original Atari schematic as analyzed in the Falstad circuit simulation and the pong-story circuit analysis. |

### 4.4 CPU difficulty
- Easy, Normal and Hard change only CPU behavior. Rules and scoring are identical.
- Objective target: in a headless simulation against a fixed reference opponent, the CPU win rate rises from Easy to Normal to Hard. Hard is beatable. Easy is beatable by a new player. The plan defines the reference opponent and the tuning.

### 4.5 High score
- The score is the winning margin: player points minus CPU points, on a player win. The margin ranges from 1 to 11.
- A loss does not score and never reaches name entry.
- One shared Top 10 covers all difficulties. A margin on Easy counts the same as one on Hard.
- The Top 10 shows rank, initials and margin. It does not show the difficulty *(default)*.

---

## 5. Preferences and examples (not requirements)
- "Black and white arcade look" sets the style. Exact sprite shapes are not required to be pixel-identical.
- Attract-loop timings, the 3-second banners and the footer wording are suggestions.
- Approximate speeds in section 3.3 are check values, not the specification.

---

## 6. Non-goals
- Game Boy shell, four shades, color overlays or cabinet art.
- Key remap screen.
- Music.
- Two-player modes (versus, alternating, doubles).
- Reproducing ROM bugs, circuit defects or hardware artifacts: Space Invaders code bugs, Pong cross-paddle interference and the ball-trapped-in-blanking bug *(default)*.
- Coin and credit display.
- Touch input and clickable on-screen controls.
- Server-side scores.
- Per-difficulty Pong score lists.

---

## 7. Edge cases and failure behavior
- **Storage failure:** see S10. The game still runs.
- **Saved data:** scores and sound state are per game, per browser profile and file location. Clearing site data erases them. Each game uses its own prefixed keys so the two games do not collide.
- **Qualification:** S8. A score of 0 never qualifies. A Pong loss never qualifies.
- **Tab hidden or blur:** S11.
- **Pause:** Enter. A PAUSE label shows *(default)*.
- **Key rules:** S4. Held keys clear on blur.
- **Name entry:** letters wrap from Z to A and from A to Z *(default)*.

---

## 8. Confirmed constraints
- Two files, each fully standalone.
- Pure black and white. No shell.
- Original titles and copyright lines stay. Private use only. Revisit before any public sharing.
- Exact rules for both games (confirmed by the owner).
- Modern evergreen desktop browser. Chrome primary.

---

## 9. Deferred ideas
- Space Invaders: the alien-pulls-the-Y attract animation, coin and credit display, two-player versus mode.
- Pong: Pong circuit quirks, a difficulty tag on Top 10 rows, two-player mode.
- Both: key remap screen, music, Game Boy shell and shades, touch controls.

---

## 10. Open questions
None.

---

## Sources
- Space Invaders ROM disassembly (primary): https://computerarcheology.com/Arcade/SpaceInvaders/
- Space Invaders hardware and object notes (secondary, derived from the above): https://pkg.go.dev/github.com/SimonBuckner/spaceinvader
- Space Invaders extra-life rule (secondary): https://c64.krissz.hu/space-invaders/play-online
- Pong overview (8-segment paddle, speed-up, top-strip gap, 11 points): https://en.wikipedia.org/wiki/Pong
- Pong circuit simulation (speed steps at 4 and 12 hits): https://www.falstad.com/pong/hbc.html
- Pong circuit analysis (7 vertical velocities, circuit defects): https://siliconchip.com.au/Issue/2021/June/Recreating+Arcade+Pong
- Pong circuit analysis (Atari schematic): https://pong-story.com/LAWN_TENNIS.pdf
