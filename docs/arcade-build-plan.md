# Space Invaders and Pong (Black and White Arcade Remakes): Build Plan

**Status:** Plan ready for implementation. No code written.
**Date:** 2026-10-17
**Source of truth:** `docs/arcade-requirements.md` (copy of the owner's requirements, dated 2026-10-16, with the I9 amendment from O2)
**Scope of this document:** Plan only. No code.

---

## 1. Requirements digest

**Goal:** Two new standalone offline HTML files, `space-invaders.html` (1978 arcade, one player) and `pong.html` (1972 Atari, one player against a CPU). Each plays the original rules in pure white on black. Each adds only a sound toggle and a Top 10 with 3-initial name entry. Private use.

**Hard constraint from the owner (this request):** The games go in the Tetris repository but are separate. No existing Tetris file or behavior changes. See part 4, decision 1.

**IDs.** The source gives IDs S1 to S14, I1 to I13 and P1 to P8. Its flow, controls, difficulty, high-score and edge-case sections have no IDs. This plan assigns IDs to them. It adds no new requirements.

| Prefix | Source section | Topic |
|---|---|---|
| S1 to S14 | 2 | Shared (source IDs) |
| IF1 to IF3 | 3.1 | Space Invaders flow |
| IK1 to IK3 | 3.2 | Space Invaders controls |
| I1 to I13 | 3.3 | Space Invaders rules (source IDs) |
| PF1 to PF3 | 4.1 | Pong flow |
| PK1 to PK2 | 4.2 | Pong controls |
| P1 to P8 | 4.3 | Pong rules (source IDs) |
| PD1 to PD2 | 4.4 | Pong CPU difficulty |
| PH1 to PH4 | 4.5 | Pong high score |
| E1 to E7 | 7 | Edge cases |

Assigned IDs, Space Invaders:

- **IF1** Attract loop: title, score advance table, Top 10, about 6 to 8 s each, blinking PRESS ENTER. **IF2** Enter starts a one-player game. **IF3** Game over banner 3 s, then name entry if qualified, then attract loop.
- **IK1** Left and Right move the cannon. **IK2** Space fires, re-fire on hold follows the ROM. **IK3** Name entry: Left and Right change the letter, Enter accepts.

Assigned IDs, Pong:

- **PF1** Title: PONG, difficulty selector (EASY, NORMAL, HARD, Normal on each load), Top 10. Up and Down change difficulty. Enter starts. **PF2** Match to 11. **PF3** Final score stays 3 s, then name entry if the player won and qualifies, then title.
- **PK1** Up and Down move the left paddle. **PK2** Name entry: Up and Down change the letter, Enter accepts.
- **PD1** Difficulty changes CPU behavior only. **PD2** Headless simulation: CPU win rate rises Easy to Normal to Hard. Hard is beatable. Easy is beatable by a new player.
- **PH1** Score is the winning margin (1 to 11) on a player win. **PH2** A loss never scores or reaches name entry. **PH3** One Top 10 for all difficulties. **PH4** Top 10 rows show rank, initials and margin, no difficulty.

Assigned IDs, edge cases:

- **E1** Storage failure (S10). **E2** Data is per game, per profile and file location, with prefixed keys per game. **E3** Score 0 and a Pong loss never qualify. **E4** Hidden tab or blur (S11). **E5** Enter pauses with a PAUSE label. **E6** Key rules (S4) and held keys clear on blur. **E7** Name-entry letters wrap Z to A and A to Z.

**Acceptance criteria.** The source has no separate acceptance-criteria list. Each requirement row is its own criterion. Part 8 gives each one a verification method.

**Non-goals (source part 6):** Game Boy shell, shades, color, cabinet art, key remap screen, music, two-player modes, ROM bugs and circuit defects, coin and credit display, touch and on-screen controls, server-side scores, per-difficulty Pong lists.

---

## 2. Repository and reference evidence

### 2.1 Repository state (read on 2026-10-17)
- Root: `gameboy-tetris.html` (2,068 lines), `README.md`, `AGENTS.md`, `CLAUDE.md`, `package.json`, `package-lock.json`, `playwright.config.mjs`, `.gitignore`, `docs/requirements.md` (Tetris), `docs/build-plan.md` (Tetris), `reference/screenshots/` (Tetris).
- Tests: `tests/unit/*.test.mjs` (9 files, 109 tests, all pass with `npm test` on Node 22), `tests/e2e/*.spec.mjs` (9 files), helpers `tests/helpers/load-logic.mjs`, `tests/helpers/game-helpers.mjs`, `tests/e2e/helpers.mjs`.
- No Makefile. Test entry points are `npm test` (`node --test "tests/unit/*.test.mjs"`) and `npm run test:e2e` (`playwright test`), `package.json:6-8`.

Test tooling:

- `playwright.config.mjs` matches `tests/e2e/*.spec.mjs` on Chromium. New spec files are picked up with no config change.
- `node_modules/` is absent in a fresh clone. E2E needs `npm ci` first. Playwright is pinned at 1.56.1.
- `tests/unit/repo.test.mjs` bans server, Docker and Railway files at the root. It covers S1 for the new files as well.

### 2.2 Tetris patterns to reuse (copy, do not import)
| Pattern | Location | Reuse |
|---|---|---|
| Logic block between `/* ==BEGIN LOGIC== */` and `/* ==END LOGIC== */`, loaded in `node:vm` | `gameboy-tetris.html:125`, `:1793`; `tests/helpers/load-logic.mjs` | Same markers in both new files. New loader takes a file path and a namespace name. |
| Fixed-timestep ticker, catch-up cap 5 | `gameboy-tetris.html:1238` `createTicker` | Copy. |
| Input: held set, press edges, ignore `e.repeat`, ignore Ctrl/Alt/Meta, `clear()` | `gameboy-tetris.html:1270-1320` `createInput` | Copy with a fixed key map (no bindings). |
| Storage adapter with probe, `try/catch`, in-memory fallback, `ok` flag, validators | `gameboy-tetris.html:1414-1455` `createStore` | Copy. New prefixes. |
| Top 10: `validateScores`, `qualifies`, `rankOf`, `insertScore` (ties below older equal scores) | `gameboy-tetris.html:1374-1411` | Copy. Name rule becomes 3 letters A to Z. |
| Integer-scaled canvas with CSS `image-rendering: pixelated` | `gameboy-tetris.html:1803-1836` | Copy for Space Invaders. |
| Blur and `visibilitychange` route to pause and `input.clear()` | `gameboy-tetris.html:1892-1905`, BOOT `:2059` | Copy. |
| AudioContext made on first keydown, any failure leaves the game silent, master gain for mute | `gameboy-tetris.html:1908-2030` | Copy the unlock, mute and suspend parts. No sequencer (no music). |
| Footer with key legend and "Scores not saved" notice | `gameboy-tetris.html:122`, `:1857` | Same idea, white on black. |
| Read-only test handle `window.gbApp` | `gameboy-tetris.html:2061` | `window.siApp` and `window.pongApp`. |

### 2.3 Space Invaders ROM evidence (read 2026-10-17)
Source: `https://computerarcheology.com/Arcade/SpaceInvaders/Code.html` (C), `RAMUse.html` (R), `Hardware.html` (H). "Mirror" is the RAM init block at ROM 1B00. Addresses are ROM addresses.

**Geometry and timing**

- **Coordinates.** ROM space is rotated: Xr runs left to right on the cabinet screen, Yr runs bottom to top. VRAM row = Xr − 0x20 (C intro, `ConvToScr` 1A47). The plan converts with screen x = Xr − 0x20 and screen y = 255 − Yr (top-down, 224×256). Phase 6 proves this with the bottom line (Yr 16), player (Yr 0x20) and saucer (Yr 0xD0) positions.
- **Frame.** 60 Hz. Mid-screen interrupt (line 96, 008C) runs objects 1 to 4 and `CursorNextAlien` (0141). End-screen interrupt (line 224, 0010) runs the fleet sound timer, `DrawAlien` (0100), the object list and `TimeToSaucer`. Objects run only in the half that matches bit 7 of their coordinate (`CompYToBeam` 1A06).
- **Objects** (`RunGameObjs` 0248): player 2010 (028E), player shot 2020 (03BB), rolling shot 2030 (0476), plunger shot 2040 (04B6), squiggly shot or saucer 2050 (0682).

**Fleet and player**

- **Fleet.** One live alien is drawn per end-screen interrupt. After index 55 the reference alien (bottom left) moves and the frame toggles (`MoveRefAlien` 01A1). Spacing 16 by 16 (017A). dX +2 or −2, +3 right with one alien left (18F1, 1597). Drop 8 per edge bump (mirror 200E). Fleet freezes while an alien or the player explodes (0105, 0141).
- **March sound** (1775): 4 tones in rotation. Counts at 1A11 `32 2B 24 1C 16 11 0D 0A 08 07 06 05 04 03 02 01`, delays at 1A21 `34 2E 27 22 1C 18 15 13 10 0E 0D 0C 0B 09 07 05`. First count ≤ live aliens selects the delay. Each tone holds 4 ticks (1767).
- **Player.** 1 px per frame, Xr 0x30 to 0xD9, Yr 0x20. Shot 4 px per run, starts at Xr+8, Yr 0x28. One shot at a time (162A). No auto-refire: `fireBounce` (202D) needs a release (1632-1651). This settles IK2. Explosion 12 changes × 5 ticks (02A7). Respawn timer 0x80 ticks, then alien fire waits 0x30 runs (02A1, 03B3).

**Shots and saucer**

- **Alien shots.** −4 Yr per move, −5 when fewer than 9 aliens (`SpeedShots` 08D8). The three shots take turns through `shotSync` (0476, 04BC, 0683). Plunger columns 1D00-1D0F `01 07 01 01 01 04 0B 01 06 03 01 01 0B 09 02 08`. Squiggly columns 1D06-1D14 `0B 01 06 03 01 01 0B 09 02 08 02 0B 04 07 0A`. Rolling aims at the column over player Xr+8 (061B). Shots fire from the lowest live alien in the column (062F). Reload by score MSB (the BCD hundreds byte, so 0x02 covers scores 200 to 299): table value ≥ MSB selects the entry (`JP NC` at 171E). ≤0x02 → 0x30, ≤0x10 → 0x10, ≤0x20 → 0x0B, ≤0x30 → 0x08, else 0x07 (170E, tables 1CB8 and 1AA1). So the last score of each bracket is 299, 1,099, 2,099 and 3,099. Plunger is off with 1 alien left (04FC).
- **Saucer.** `tillSaucer` starts at 0x0600. `TimeToSaucer` (0913) returns early while reference Yr ≥ 0x78. Otherwise it tests the counter for zero (091C) before it decrements (0929), so the first saucer is flagged on eligible call 0x601 (1,537) and later ones every 0x600 calls. Needs ≥ 8 aliens and no squiggly shot (06A1, 0691). Direction from `shotCountLSB` bit 0 (0462). Yr 0xD0. Score table 1D54 in BCD. Pointer moves at the end of every player-shot blow-up (`EndOfBlowup` 0447), wraps after 15 entries (044C). The saucer task runs only when `shotSync` = 2 (0683), so the score read at show-hit 0x18 (070C) comes about 24 frames after the hit. The hitting shot's 16-frame blow-up has ended by then, so the hitting shot is counted: hit with shot N (1-based) scores entry N mod 15. Shot 8 and shot 23 score 300. The 15 values equal I7. Reset per rack (09FD).

**Shields, waves and end rules**

- **Shields.** 4 shields, 22×16 px, Xr 64, 109, 154, 199, Yr 48-63 (01F8, 021E-023D). Erosion is pixel based: shot explosion sprites are drawn then AND-NOT erased (1452, 1491). Aliens overwrite shield pixels (15D3).
- **Waves.** Rack 1 reference Yr 0x78. Racks 2 to 9 from 1DA3 `60 50 48 48 48 40 40 40` (byte-checked in the downloaded copy). Index = (rack count AND 7) + 1, so rack 10 repeats 0x60 (0A0C).
- **Extra life** at score MSB ≥ 0x15 (1,500), once (0935). **Invasion:** a live alien with Yr < 0x28 ends the game (016B, 1971).
- **Animation and score.** 2 frames. Rows 0-1 (bottom) 10 pts, rows 2-3 20 pts, row 4 30 pts (1DA0). Alien explosion 16 ticks (152A).

**Known bugs and open reads**

- **Known ROM bugs.** `CodeBug1` (C, near 1504): wrong row and column lookup when aliens are inside the shields. Not reproduced (non-goal). The 044C wrap is kept because I7 asks for the 15-entry behavior.
- **Not yet confirmed:** moves per frame for each alien shot and the saucer. Phase 7 reads handlers 0476, 04B6, 0682 and `shotSync` in C. Cross-check: player shot 4 px × 60 = 240 px/s. Alien shot 4 px every 3rd frame = 80 px/s. Both match the source check values.

### 2.4 Pong circuit evidence (read 2026-10-17)
Sources: Edwards, "Reconstructing Pong on an FPGA" (E, linked from `falstad.com/pong`), Falstad pages (F), Holden `pong-story.com/LAWN_TENNIS.pdf` (Ho), Silicon Chip June 2021 (SC), MAME `src/mame/atari/nl_pong.cpp` (M).

**Geometry**

- **Timing.** 7.159 MHz, 455 clocks per line, 262 lines, 60.05 Hz (E 1.1-1.3). Visible area H 80-454 by lines 16-261 = 375 × 246 units (E 1.4, 1.9).
- **Native coordinates used by this plan:** x = H − 80 (0 to 374), y = line − 16 (0 to 245). One x unit is one clock. One y unit is one line.
- **Paddles.** 4 units wide. Left at x 48-51, right at x 304-307 (E 1.6). Height: 15 lines (E, F) or 16 (Ho). Plan uses 16, so 8 segments are 2 lines each (decision 9).
- **Segments to vertical velocity** (E Fig. 11, F vbc), top to bottom: −3, −2, −1, 0, 0, +1, +2, +3 lines per frame (negative is up). That gives 7 values (P3).

**Ball and serve**

- **Ball.** 4 × 4 (E 1.8, Ho p37). Horizontal speed: 2, 3 or 4 units per frame for under 4 hits, 4 to 11 hits, 12 or more (Ho p50-51 and M agree; F hbc says 1/2/3 for its scaled demo). Plan uses 2/3/4 (decision 10). A miss resets the counter (F hbc, M).
- **Walls.** Ball bounces at the top and bottom edges. The vertical value inverts (Ho p44, p46).
- **Serve.** About 1.7 s after a point (E 1.12). Ball appears at x 182 (H 262). Direction stays, so it goes toward the side that missed. Vertical velocity and position stay as at the miss (Ho p71-72, F serve).

**Display, sound and exclusions**

- **Score digits.** Lines 32-63 (y 16-47). Left window x 48-111, right x 240-303. Two 32-unit cells each, digit 16 wide × 32 tall, 4-unit strokes. Leading zero blank (M, Ho p61). The original digits are dim. S2 makes them white.
- **Net.** 1 unit wide at x 176, 4 lines on and 4 off (E 1.5).
- **Sounds.** Paddle hit 491 Hz, about 1 frame. Wall 246 Hz, about 16 ms, muted during serve. Point 246 Hz, about 240 ms (Ho p67, E 1.11, F scoresound). E 1.11 states 980 Hz for wall and point, but that is an arithmetic error: the source is bit 32 (the sixth bit) of the vertical ball counter, clocked at 15.734 kHz, so it is 15,734 / 64 = 246 Hz. Bit 16 gives 491 Hz for the paddle hit, as E states. Ho p67 states 246 Hz for both bounce and score.
- **Top strip (P5).** The 555 timer cannot reach the top lines (F paddle1, E 1.6). No source gives the line count. MAME marks its pot values as a guess (`nl_pong.cpp:377`). Plan uses a named constant (decision 11).
- **Defects not reproduced:** cross-paddle interference (E 1.9, SC bug 1), ball trapped in blanking (SC bug 2, Ho p47), drawing in blanking, weak net, sync shift (SC bugs 4-6). Kept: a paddle hit sets direction, so the ball never sticks in a paddle (E 1.8).

---

## 3. Decisions taken and interpretations

### 3.1 Owner decisions in this session
| ID | Decision |
|---|---|
| O1 | Plan path is `docs/arcade-build-plan.md`. Requirements copy is `docs/arcade-requirements.md`. |
| O2 | Wave start heights follow the ROM table (2.3 Waves), including the repeat from rack 10. The I9 values are not used. The I9 numbers came from secondary notes and disagree with ROM table 1DA3. |

### 3.2 Interpretations (non-blocking, cheap to change)
| ID | Reading | Basis |
|---|---|---|
| R1 | Sound is ON on first load. | S5 gives no default. |
| R2 | Name entry changes one letter per key press. No hold repeat. | S7 and S4 (OS repeat ignored). |
| R3 | Empty Top 10 rows show rank and `--- ----` (Space Invaders) or `--- --` (Pong). | S9 needs a list on the title. No empty format given. |
| R4 | Space Invaders follows the Midway ROM set that the disassembly covers (I13). Its code skips the `*TAITO CORPORATION*` message (C 1986-1993), so that line is not shown. Pong shows only the PONG title. No copyright line is invented. | S14 keeps original lines. I13 names the Midway disassembly as the authority. The Taito ROM prints the line. To show it instead, change Phase 9 only. |
| R5 | Enter during the attract loop or title always starts. Enter during the game-over banner or final score does nothing (fixed 3 s). | IF3, PF3 give a fixed 3 s. |
| R6 | Pong first serve of a match goes toward the player from the net with vertical velocity +1. | Circuit gives no first-serve rule. A non-zero value avoids a flat first rally. |
| R7 | Pong paddle key speed is 4 lines per frame (about 1 s top to bottom). Tuned in Phase 3 with the CPU. | Original uses a knob. Keyboard needs a rate. |
| R8 | The footer is white on black, outside the canvas. | S2 and S12. |
| R9 | The pause label shows over the frozen game. M works while paused. | E5. |
| R10 | Space Invaders sound frequencies and envelopes are chosen by ear to match the original. | The original sounds are analog circuits. No ROM numbers exist for pitch. |

---

## 4. Approach and key decisions

**Structure**

1. **Tetris isolation.** No change to any existing file: `gameboy-tetris.html`, `tests/**` files that exist today, `tests/helpers/*`, `package.json`, `package-lock.json`, `playwright.config.mjs`, `README.md`, `docs/requirements.md`, `docs/build-plan.md`. All new work is new files. This overrides `AGENTS.md` Edits rule 6 (migrate all call sites): Tetris keeps its own loader and helpers. Every phase checks `git diff --name-only <base> -- <Tetris paths>` is empty and the 109 Tetris unit tests still pass.
2. **Two standalone files, shared text copied.** S1 forbids shared external files. Both files carry an identical `ARCADE` section (ticker, input, store, scores, name entry, sound flag) inside the logic block and an identical `ARCADE PLATFORM` section (screen fit, footer, audio core, blur and visibility). One shared test suite runs against both files, so each copy is tested for behavior.
3. **Pure logic block, same markers as Tetris.** Sections `ARCADE`, `CONST`, `RULES`, `DATA`, `VIEW`, `APP` sit between the logic markers with no DOM, storage or audio calls. Namespaces: `SI` for Space Invaders, `PONG` for Pong. New loader `tests/helpers/load-arcade.mjs` exports `loadGame(fileName, ns)` and returns `{ ARCADE, <ns> }`.

**Space Invaders engine**

4. **Space Invaders runs on a 1-bit bitmap like the ROM.** The rules engine owns a 224×256 `Uint8Array` playfield. Collision, shield erosion and alien overwrite are pixel tests on that bitmap, as in the ROM (2.3 Shields). This is the only way to get exact erosion and hit rules. HUD text is drawn by `VIEW` on a copy.
5. **Space Invaders timing is per interrupt.** One `step()` is one 60 Hz frame: a mid-screen half, then an end-screen half. Each object runs in the half that matches its coordinate bit 7, as in the ROM. All counters are in ticks.
6. **Space Invaders values stay in ROM units.** Constants use Xr and Yr and the ROM hex values with the ROM address in a comment. One conversion function maps to screen pixels.

**Pong engine**

7. **Pong runs in native circuit units.** Rules use x 0 to 374 and y 0 to 245 at 60.05 Hz.
8. **Pong renders rectangles.** Everything in Pong is a rectangle. `VIEW` returns a list of rectangles in native units. The platform maps them to a 4:3 canvas and snaps every edge to whole device pixels. No smoothing, so only black and white pixels exist (S2, S3).
9. **Pong paddle height 16.** 8 segments of 2 lines. Sources disagree (15 or 16). 16 gives equal segments (P3).
10. **Pong horizontal speed 2, 3, 4.** Holden and the MAME netlist agree. The Falstad page is a scaled demo.
11. **Pong top strip.** Constant `PADDLE_MIN_Y = 16` lines. Unverified assumption: no source states the count. Verify by eye against a Pong video or MAME run. The bottom edge is reachable (P5 names only the top).

**Pong CPU**

12. **CPU model (PD1, PD2).** The CPU paddle follows the same paddle rules as the player. Three parameters per difficulty: reaction delay (frames before it reacts to a new ball direction), maximum speed (lines per frame) and aim error (random offset from the paddle center, drawn once per return). Random source is injected.
13. **Reference opponents for PD2.** Both bots and the match runner live in `tests/unit/pong-cpu.test.mjs`. `pong.html` ships only the CPU and the rules. Bots and the CPU use one controller shape: `move(view) → lines per frame`, where `view` holds what a player sees.
    - `REF` (fixed reference): reaction 8 frames, speed 4 (same as the player), aim error ±4 lines.
    - `NOVICE` (new player): reaction 14 frames, speed 3, aim error ±7 lines.
    - Targets over 300 seeded matches each: CPU win rate vs `REF` is Easy ≤ 35%, Normal 40% to 65%, Hard 70% to 90%, strictly rising. `NOVICE` beats Easy in ≥ 50% of matches. Hard ≤ 90% vs `REF` is "beatable".

**Storage, art, audio and tests**

14. **Storage keys.** `spaceinvaders.v1.scores`, `spaceinvaders.v1.sound`, `pong.v1.scores`, `pong.v1.sound`. Tetris uses `gbtetris.v1.` (`gameboy-tetris.html:163`). No collision (E2). Any backend error after the probe sets the backend to null for the session, so later loads read the in-memory values. This fixes a gap in the Tetris adapter: there a failed `setItem` leaves the backend live, and the next load reads the old stored value. Corrupt data counts as a storage failure (S10 says "unavailable or corrupt"): a JSON parse error or any invalid entry makes the load return the default, sets `ok` to false and drops the backend for the session. Validators therefore reject the whole value instead of filtering entries.
15. **Art.** Space Invaders sprites and font are redrawn by eye at the ROM sizes. ROM bitmap bytes are not copied. Shapes need not be pixel-identical (source part 5). Sizes are fixed because collision depends on them.
16. **Audio.** WebAudio. Tones are square oscillators. Explosions and shots use a filtered noise buffer. Mute sets master gain to 0. Pause and hidden tab suspend the context.
17. **Tests.** Unit tests with `node:test`, no new packages. E2E with the existing Playwright. No dependency changes.

---

## 5. New file layout

```
space-invaders.html              deliverable 1
pong.html                        deliverable 2
docs/arcade-requirements.md      copy of the source requirements (added with this plan)
docs/arcade-build-plan.md        this plan
tests/helpers/load-arcade.mjs    loadGame(fileName, ns)
tests/unit/arcade-common.test.mjs
tests/unit/pong-*.test.mjs       rules, cpu, view, app
tests/unit/si-*.test.mjs         const, rules, shots, view, app
tests/e2e/arcade-helpers.mjs     openArcade(page, file), pixel probes
tests/e2e/pong-*.spec.mjs
tests/e2e/si-*.spec.mjs
```

HTML section order in each file: `HEAD/CSS`, `DOM`, `ARCADE`, `CONST`, `RULES`, `DATA`, `VIEW`, `APP`, `ARCADE PLATFORM`, `PLATFORM`, `BOOT`. A header comment lists the sections, the sources and the test commands (as in `gameboy-tetris.html:1-24`).

---

## 6. Phases

Pong goes first. It is smaller and proves the shared layer before the larger Space Invaders build.

### Phase 1: Shared layer and two blank screens

**Goal**
Both files open from `file://` to a black screen with a footer. The shared logic passes its unit tests. Tetris tests still pass.

**Requirements covered**
S1, S4, S6, S7, S8, S10, S12 (footer shell), S13, E1, E2, E3, E6, E7

**Changes**
- Create `space-invaders.html` and `pong.html` with the section layout in part 5. Canvas `#screen`, footer `#footer` with key legend, sound state and `#notice` ("Scores not saved").
- `ARCADE` section, core (identical in both files):
  - `createTicker(fps, cap)` (copy of Tetris).
  - `createInput(keyMap)`: fixed map of `KeyboardEvent.code` to actions. Ignores `repeat` and Ctrl/Alt/Meta. `clear()`.
  - `createStore(getBackend, prefix)`: copy of Tetris with a prefix argument. Any error on `getItem` or `setItem` drops the backend and switches to memory (decision 14).
- `ARCADE` section, scores and settings (identical in both files):
  - Scores: `validateScores`, `qualifies`, `rankOf`, `insertScore`. Entry `{ name: 3 letters A-Z, score: int }`. Max score is a parameter (9,999 or 11). `validateScores` returns null when any entry is invalid (decision 14).
  - `createNameEntry({ prevKey, nextKey })`: 3 slots, each starts at A, wrap both ways, Enter accepts a slot, returns the name after slot 3.
  - Sound flag load and save with validator (boolean, default true, R1).
- `ARCADE PLATFORM` section (identical in both files): fit-to-window (stage = window minus footer, keep aspect, black margins, no scrollbars), footer renderer, audio core (unlock on first keydown, master gain, `setMuted`, `suspend`, `resume`, `tone(freq, ms)`, `noise(ms, filter)`), blur and visibility binding.
- `tests/helpers/load-arcade.mjs`, `tests/unit/arcade-common.test.mjs`, `tests/e2e/arcade-helpers.mjs`, `tests/e2e/arcade-load.spec.mjs`.

**Implementation notes**
- Copy Tetris code. Do not edit `gameboy-tetris.html` or its helpers.
- CSS: `html, body` black, `overflow: hidden`, canvas `image-rendering: pixelated`.

**Tests**
Shared suite (`tests/unit/arcade-common.test.mjs` runs each test once per file, `pong.html` and `space-invaders.html`):

- Unit: ticker returns 0 on the first call, the right step count for a normal advance, keeps the remainder, and caps at 5 steps with the backlog dropped (copy of the Tetris ticker, now tested per arcade file).
- Unit: input ignores repeat and modifier combos, tracks edges, `clear()` empties held keys (S4, E6).
- Unit: store with a throwing backend, a backend that throws on `setItem` and corrupt JSON. Game values fall back, `ok` is false (S10, E1). For each error path, a save then a load in the same session returns the saved value.
- Unit: qualification matrix: 0 never qualifies, fewer than 10 entries qualifies, must beat the 10th, ties rank below older (S8, E3).
- Unit: name entry wraps Z to A and A to Z, starts at A, saves after slot 3 (S7, E7).

Validation and load:

- Unit: validators reject names that are not 3 letters A to Z, non-integer scores and scores above the max.
- Unit: well-formed JSON with one invalid score entry or a non-boolean sound value: `store.load` returns the default and `ok` becomes false (S10, decision 14).
- Unit: after any failure (throw or corrupt data), a backend spy records no further `getItem` or `setItem` call in the same session (decision 14).
- E2E: each file loads with no console output and zero network requests (S1). Body has no scrollbars at 800×600 and 1920×1080.

**Acceptance criteria**
- `npm test` passes: 109 Tetris tests plus the new tests.
- `npm run test:e2e` passes, Tetris specs included.
- `git diff --name-only <base>` lists only new files.

**Dependencies**
None.

---

### Phase 2: Pong rules engine

**Goal**
A deterministic Pong engine plays full matches in Node with two paddle inputs.

**Requirements covered**
P1 (geometry), P2, P3, P4, P5, P6, P8

**Changes**
In `pong.html`:
- `CONST`: all values in 2.4 with source comments. 60.05 Hz. Field 375 × 246. Paddle 4 × 16 at x 48 and 304. `PADDLE_MIN_Y = 16`. Ball 4 × 4. Speeds 2/3/4 with thresholds 4 and 12. Segment table −3..+3. Serve delay 1.7 s in frames. Serve x 182. Win score 11.
- `RULES`: `createMatch({ rng })`, `step(match, { left, right })` where each is a target paddle move in lines per frame. Returns events: `paddleHit`, `wallHit`, `point`, `serve`, `matchOver`.
- Paddle hit sets direction away from the paddle (never toggles). Segment sets vertical velocity. Hit counter increments, caps at 12. Miss resets it.
- Wall bounce inverts vertical velocity. Ball stays in the field (no blanking trap).
- Point when the ball passes a paddle edge and leaves the field. Serve after the delay, toward the side that missed, with vertical position and velocity kept (P6). First serve per R6.

**Implementation notes**
- No win-by-two. Match ends the frame a side reaches 11.
- Paddle position clamps to `PADDLE_MIN_Y` at the top and the field bottom.

**Tests**
Paddle and ball:

- Each of the 8 segments gives the table velocity. Center segments give 0 (P3).
- Speed is 2 for hits 0-3, 3 for hits 4-11, 4 from hit 12. A miss resets to 2 (P4).
- Paddle top never goes above `PADDLE_MIN_Y` (P5).
- Wall bounce inverts vertical velocity, ball never leaves y 0 to 245.

Serve and match:

- After a left miss the serve moves left, and the reverse (P6). Serve waits the delay. After a miss at a non-center y with non-zero vertical velocity, the served ball keeps that y and that velocity.
- Match ends at 11-x, also at 11-10 (P2).
- Fuzz: 1,000 seeded random matches finish with valid state.

**Acceptance criteria**
- All unit tests pass. Every value not in the requirements has a source comment (P8).

**Dependencies**
Phase 1.

---

### Phase 3: Pong CPU and difficulty tuning

**Goal**
The CPU has three tuned levels. A headless test proves PD2.

**Requirements covered**
PD1, PD2

**Changes**
- In `pong.html` `APP`: `createCpu(level, rng)` with the controller shape from decision 13. `DIFFICULTY` table with reaction delay, max speed and aim error per level. `playerView(match, side)` builds the view a player sees.
- New `tests/unit/pong-cpu.test.mjs`: bots `REF` and `NOVICE`, a match runner that drives `PONG.RULES.step` with two controllers, and the simulation tests. No test code goes into `pong.html`.

**Implementation notes**
- The CPU sees only state a player sees (ball position and direction, own paddle). No reading of the future serve.
- Tune the table until the targets in decision 13 hold. Record the final win rates in a comment next to the table.
- Keep the simulation under 20 s in total. Use fixed seeds.

**Tests**
- 300 matches per level vs `REF`: rates inside the target bands and strictly rising (PD2).
- 300 matches `NOVICE` vs Easy: novice wins ≥ 50%.
- Rules check: the same match seed with any level gives the same rules (field, speeds, win score). Only CPU moves differ (PD1).

**Acceptance criteria**
- Tests pass with fixed seeds on two runs.

**Dependencies**
Phase 2.

---

### Phase 4: Pong playable on screen

**Goal**
Opening `pong.html` and pressing Enter plays a match against the Normal CPU with sound, pause and blur pause.

**Requirements covered**
P1 (look), P7, S2, S3, S4, S5, S11, S12, PK1, E4, E5, E6

**Changes**
- `VIEW`: `renderMatch(match, opts)` returns rectangles: paddles, ball, dashed net, score digits (segment rects from 2.4), PAUSE label.
- `PLATFORM`: 4:3 canvas, maps native units to device pixels with whole-pixel edges.
- `APP`: temporary flow (Enter starts a match, match over returns to a blank title). Replaced in Phase 5.
- Sound: paddle 491 Hz about 1 frame, wall 246 Hz 16 ms (not during serve), point 246 Hz 240 ms. M toggles and saves.
- Footer: `↑ ↓ MOVE  ENTER START/PAUSE  M SOUND: ON`.

**Implementation notes**
- Up and Down hold moves the paddle at R7 speed.
- The ball is hidden during the serve delay.

**Tests**
Layout and look:

- Unit: rectangle list for a fixed state (positions, net dashes 4 on 4 off, digits for 0, 7, 11, leading zero blank).
- E2E: canvas keeps 4:3 at 800×600, 1600×900, 900×1200. Margins are black. No scrollbars (S3).
- E2E: every sampled canvas pixel is pure black or pure white (S2).

Input and audio:

- E2E: Enter pauses and shows PAUSE. Blur and hidden tab pause and suspend audio. Held keys clear (S11, E4, E5, E6).
- E2E with a stubbed AudioContext: no context before the first key, one tone per event with the right frequency and length (paddle hit 491 Hz about 1 frame, wall hit 246 Hz about 16 ms, point 246 Hz about 240 ms), none while muted, M state survives reload (S5, P7).
- E2E: an OS key-repeat event does not change paddle travel (S4).

**Acceptance criteria**
- All tests pass. Owner plays one match and confirms the look and sounds.

**Dependencies**
Phase 3.

---

### Phase 5: Pong title, Top 10 and name entry

**Goal**
Full Pong flow: title with difficulty and Top 10, match, 3 s final score, name entry on a qualifying win, back to title.

**Requirements covered**
PF1, PF2, PF3, PK2, PH1, PH2, PH3, PH4, S6, S7, S8, S9, S10, S12 (notice), S14, E1, E2, E3

**Changes**
- `APP` screens: `title`, `play`, `final`, `nameEntry`. Remove the Phase 4 temporary flow.
- Title: PONG, EASY / NORMAL / HARD with a marker, Top 10 (rank, initials, margin), blinking PRESS ENTER.
- Score on win = player points − CPU points. Loss skips name entry.
- Storage `pong.v1.scores`, `pong.v1.sound`. Footer notice when `store.ok` is false.

**Implementation notes**
- Normal is selected on every load and is not saved.
- Text uses a block font built from rectangles at the score-digit style.

**Tests**
Unit:

- Unit: margin math for 11-0 (11), 11-10 (1). Loss gives no entry (PH1, PH2).
- Unit: difficulty selector Up and Down, no wrap, default Normal.

Flow:

- E2E: after the 11th point the `final` screen still shows just before 3 s and moves on at 3 s (PF3).
- E2E: scripted win (CPU stubbed to miss) goes to name entry, Up and Down change letters, Enter 3 times saves, title shows the row, survives reload (PK2, S6, S9).
- E2E: scripted loss returns to title with no name entry (PH2).
- E2E: with a full Top 10 whose 10th margin is 5, a 3-point win returns to the title with no name entry and the list unchanged (S8, PF3).
- E2E: wins on Easy and Hard land in one list (PH3). Rows show no difficulty (PH4).

Storage:

- E2E: blocked localStorage shows "Scores not saved" and the game still plays (S10).
- E2E: Tetris key `gbtetris.v1.scores` is untouched after a Pong save (E2).

**Acceptance criteria**
- All tests pass. Pong meets every PF, PK, PH and P item in part 8.

**Dependencies**
Phase 4.

---

### Phase 6: Space Invaders constants, fleet, player and shields

**Goal**
A Node engine runs the fleet, player, player shot, shields, scoring, lives, waves and invasion with ROM timing.

**Requirements covered**
I1, I2, I3, I4, I5, I8, I9 (per O2), I10, I11 (score cap and values), I13

**Changes**
In `space-invaders.html`:
- `CONST`: all 2.3 values in ROM units with ROM addresses. Coordinate conversion function.
- `DATA`: redrawn sprites at ROM sizes: 3 alien types × 2 frames, player, 2 player explosion frames, shield (22×16), player shot, shot explosion, alien explosion.
- `RULES`: `createGame({ rng })`, `step(game, { left, right, fire })` with mid-screen and end-screen halves. Owns the 224×256 bitmap. Object list order as `RunGameObjs`. Fleet cursor and reference alien. Player move, fire with release rule, explosion, respawn. Shield erosion and alien overwrite by bitmap. Invader hit with 16-tick explosion and fleet freeze. Wave start Yr from the ROM table with the AND 7 index. Extra life at 1,500 once. Invasion at Yr < 0x28. Score cap 9,999.
- Events: `march(tone)`, `shot`, `alienHit`, `playerHit`, `extraLife`, `waveClear`, `gameOver`.

**Implementation notes**
- Alien shots and the saucer are stubbed off in this phase. Phase 7 adds them.
- Fix `CodeBug1`: find the row and column from the hit point directly.

**Tests**
Fleet and scoring:

- 55 aliens in 5 × 11 at the rack 1 start. Points 30, 20, 20, 10, 10 by row (I1, I2).
- Fleet step period equals live aliens (frames per full step) for 55, 30, 1. dX +3 right with 1 alien. Drop 8 at each edge (I4).
- March tempo: delay from the 1A11 and 1A21 tables for each count bracket (I4, I12 timing).
- Wave start Yr for racks 1 to 10 equals `78 60 50 48 48 48 40 40 40 60` (I9 per O2).
- Score caps at 9,999.

Player, shields and end rules:

- Player shot 4 px per run. Second fire is refused while a shot is live. Holding fire does not re-fire after a hit (I5, IK2).
- Extra life once at 1,500. Lives start at 3 (I3).
- An alien reaching Yr < 0x28 ends the game. Losing the last life ends the game (I10).
- Shield pixel count drops after a player shot hits it. Aliens erase shield pixels when they reach shield rows (I8).
- Coordinate conversion puts the bottom line at screen y 239 and the player at y 223 (2.3 Coordinates).

**Acceptance criteria**
- All tests pass. Every value not in the requirements has a ROM address comment (I13).

**Dependencies**
Phase 1.

---

### Phase 7: Space Invaders alien shots and saucer

**Goal**
Three alien shot types and the saucer run with ROM rules.

**Requirements covered**
I6, I7, I13

**Changes**
In `RULES`: rolling, plunger and squiggly shots with `shotSync` turns, column tables, rolling aim, lowest-alien source, reload brackets, speed change below 9 aliens, plunger off at 1 alien, hit tests on player, shields and player shot. Saucer timer, conditions, direction from shot count bit 0, score table with the 15-entry wrap, hit sequence, per-rack reset.

**Implementation notes**
- First confirm the moves per frame of each shot and the saucer in C (handlers 0476, 04B6, 0682 and `shotSync`). Record the result with addresses. Check against 80 px/s for alien shots.

**Tests**
Alien shots:

- Plunger and squiggly columns follow the tables and wrap (I6).
- Rolling shot picks the column over the player (I6).
- Reload rate at each bracket edge: 0 and 299 → 0x30, 300 and 1,099 → 0x10, 1,100 and 2,099 → 0x0B, 2,100 and 3,099 → 0x08, 3,100 → 0x07 (I6, 2.3 reload).
- Alien shot speed −4, then −5 below 9 aliens. Measured speed is about 80 px/s.

Shot effects:

- Over a seeded run, the `shotSync` cycle fires rolling, plunger and squiggly shots in turn, in the ROM order (I6).
- An alien shot that hits a shield clears shield pixels and ends that shot (I8).
- A hit on the player starts the explosion and removes a life.
- A non-final hit: the explosion ends after 12 × 5 ticks, the cannon respawns when the player task timer (0x80 ticks, mirror 2011) runs out, alien fire resumes after 0x30 more player runs and play continues. Confirm in C (028E, 02A1) whether the two timers run in sequence or overlap, and assert that order (2.3 Player).

Saucer:

- No saucer through eligible `TimeToSaucer` call 1,536. Flagged on call 1,537, then every 1,536 calls. No counting while reference Yr ≥ 0x78. Appears only with ≥ 8 aliens and no squiggly shot. Direction follows shot count parity (I7).
- Saucer hit with shot N (1-based, the hitting shot counted) scores table entry N mod 15 of `100 50 50 100 150 100 100 50 300 100 100 100 50 150 100`. Check N = 1 (50), 8 (300), 15 (100), 23 (300) (I7, 2.3 Saucer).

**Acceptance criteria**
- All tests pass. A seeded replay of 3 scripted games gives fixed scores and bitmap hashes.

**Dependencies**
Phase 6.

---

### Phase 8: Space Invaders playable on screen

**Goal**
Opening `space-invaders.html` and pressing Enter plays a full game with HUD, sound, pause and blur pause.

**Requirements covered**
I11, I12, S2, S3, S4, S5, S11, S12, IK1, IK2, E4, E5, E6

**Changes**
- `VIEW`: composite the rules bitmap with HUD: SCORE (4 digits), HI-SCORE (Top 10 first entry or 0000), lives digit and ship icons, bottom line, PAUSE label. Redrawn font with digits, A to Z and the ROM message characters.
- `PLATFORM`: 224×256 framebuffer, integer-scaled portrait canvas.
- Temporary flow (Enter starts, game over returns to a blank screen). Replaced in Phase 9.
- Sound: march 4 tones at the rules tempo, player shot, invader hit, player explosion, UFO loop while it flies, UFO hit (R10).
- Footer: `← → MOVE  SPACE FIRE  ENTER START/PAUSE  M SOUND: ON`.

**Tests**
Layout and look:

- Unit: HUD framebuffer for score 0 and 9,999, HI-SCORE 0000 with an empty list and the first entry with a list (I11).
- E2E: portrait aspect at the Pong viewport matrix, black margins, no scrollbars (S3).
- E2E: every sampled pixel is pure black or white (S2).

Input and audio:

- E2E: pause, blur and hidden tab pause the game and suspend audio. Held keys clear (S11, E4, E5, E6).
- E2E with stubbed AudioContext: each of the 6 effects fires on its event, none when muted, sound state survives reload (S5, I12).
- E2E: Space held does not re-fire. Left and Right move the cannon (IK1, IK2).

**Acceptance criteria**
- All tests pass. Owner plays one game and confirms look and sounds.

**Dependencies**
Phase 7.

---

### Phase 9: Space Invaders attract loop, Top 10 and name entry

**Goal**
Full flow: attract loop, game, 3 s banner, name entry on a qualifying score, back to attract.

**Requirements covered**
IF1, IF2, IF3, IK3, S6, S7, S8, S9, S10, S14, E1, E2, E3

**Changes**
- `APP` screens: `attract` (title, score advance table, Top 10 at 7 s each, blinking PRESS ENTER), `play`, `gameOver`, `nameEntry`. Remove the Phase 8 temporary flow.
- Title texts from the ROM messages (PLAY, SPACE INVADERS, \*SCORE ADVANCE TABLE\*, =? MYSTERY, =30 POINTS, =20 POINTS, =10 POINTS). Read exact strings from C message tables.
- Storage `spaceinvaders.v1.scores`, `spaceinvaders.v1.sound`. Footer notice when `store.ok` is false.

**Tests**
Flow:

- Unit: attract loop cycles 3 screens on the timer. Enter starts from any of them (IF1, IF2).
- Unit: PRESS ENTER is drawn in some attract frames and not in others within one blink period, on every attract screen (IF1).
- E2E: scripted game over (rules hook to end the game) shows the banner for 3 s, then name entry with Left and Right letter changes, saves, attract Top 10 shows it, HUD HI-SCORE shows it after reload (IF3, IK3, S6, S9, I11).
- E2E: score 0 skips name entry (E3).
- E2E: with a full Top 10 whose 10th score is 500, a game over at 300 returns to the attract loop with no name entry and the list unchanged (S8, IF3).

Storage:

- E2E: blocked localStorage shows the notice and the game still plays (S10).
- E2E: Pong and Tetris keys are untouched by a Space Invaders save (E2).

**Acceptance criteria**
- All tests pass. Space Invaders meets every IF, IK and I item in part 8.

**Dependencies**
Phase 8.

---

### Phase 10: Full acceptance for both games

**Goal**
Both games pass the full traceability table. Tetris is unchanged.

**Requirements covered**
All rows in part 8 (final check), S13, S14

**Changes**
- Header comments in both files: sections, sources, test commands, private-use note.
- Fix any gaps the checks find.

**Tests**
- Full `npm test` and `npm run test:e2e`.
- Review: `git diff --name-only <base>` lists only the new files in part 5.
- Review: no `fetch`, `XMLHttpRequest`, `import`, external `src` or `href` in either file (S1).
- Owner checks: play each game once on Chrome. Confirm look, sound and the feel of the three difficulty levels (Easy beatable).

**Acceptance criteria**
- Every row in part 8 shows its verification passed.
- Tetris unit and E2E suites pass with no file changes.

**Dependencies**
Phases 5 and 9.

---

## 7. Cross-cutting work (each item has an owner phase)

| Concern | Decision | Phase |
|---|---|---|
| Tetris compatibility | No edits to existing files. Diff check and Tetris suites in every phase. | 1 to 10 |
| Shared code drift | One `ARCADE` behavior suite runs against both files. | 1 |
| Privacy and security | No network, no external resources, no `eval`. E2E asserts zero requests. | 1, 10 |
| Storage namespace | Per-game prefixes. Cross-game isolation E2E. | 5, 9 |
| Compatibility | Chromium E2E. Chrome primary (S13). | 4, 8, 10 |
| Accessibility | Not required. Footer is real text. Canvas has an `aria-label`. | 4, 8 |
| Deployment and rollback | None. Open the file. Version control only. | None |
| Documentation | Header comments. `docs/arcade-requirements.md`. No README change (owner asked for no Tetris changes). | 1, 10 |
| Cleanup | Phase 4 and Phase 8 temporary flows are removed in Phases 5 and 9. | 5, 9 |

---

## 8. Requirements traceability

| Requirement | Planned phase | Verification |
|---|---|---|
| S1 Two standalone offline files | 1, 10 | E2E zero requests. `repo.test.mjs`. Source review |
| S2 Pure black and white | 4, 8 | E2E pixel probe (only 0 or 255) |
| S3 Fit window, aspect, pixel-sharp, no scrollbars | 1, 4, 8 | E2E viewport matrix |
| S4 Fixed keys, repeat and modifiers ignored | 1, 4, 8 | Unit input. E2E repeat event |
| S5 Synth effects, M toggle saved, audio after first key | 4, 8 | E2E stubbed AudioContext. Owner listening |
| S6 Per-game Top 10 in localStorage | 1, 5, 9 | Unit store. E2E reload |
| S7 3-slot A-Z name entry | 1, 5, 9 | Unit. E2E |
| S8 Qualification and ties | 1 | Unit matrix |
| S9 Top 10 on title, no hotkey | 5, 9 | E2E |
| S10 Storage failure fallback and notice | 1, 5, 9 | Unit fake backends. E2E blocked storage |
| S11 Hidden or blur pauses game and sound | 4, 8 | E2E |
| S12 Footer with keys, sound state, notice | 1, 4, 5, 8, 9 | E2E text check |
| S13 Evergreen desktop, Chrome primary | 10 | E2E on Chromium. Owner check on Chrome |
| S14 Private use, original titles kept | 5, 9, 10 | Review of title text (R4) |
| IF1 Attract loop of 3 screens | 9 | Unit timer. E2E |
| IF2 Enter starts | 9 | E2E |
| IF3 3 s banner, name entry, attract | 9 | E2E |
| IK1 Left and Right move | 8 | E2E |
| IK2 Space fires, no auto-refire (ROM) | 6, 8 | Unit. E2E |
| IK3 Name entry Left and Right | 9 | E2E |
| I1 224×256, 5 × 11 fleet | 6, 8 | Unit. E2E canvas size |
| I2 30, 20, 10 points | 6 | Unit |
| I3 3 lives, extra at 1,500 | 6 | Unit |
| I4 Fleet speed-up, ROM timing | 6 | Unit step period and tables |
| I5 One player shot | 6 | Unit |
| I6 Three shot types, tables, reload | 7 | Unit |
| I7 Saucer timer and 15-entry table | 7 | Unit |
| I8 Four eroding shields | 6, 7 | Unit pixel counts |
| I9 Wave start heights (ROM per O2) | 6 | Unit racks 1 to 10 |
| I10 Game over conditions | 6 | Unit |
| I11 HUD, HI-SCORE, lives, cap 9,999 | 6, 8, 9 | Unit framebuffer. E2E |
| I12 Six sound effects | 8 | E2E stubbed audio. Owner listening |
| I13 ROM is the authority | 6, 7 | Review: ROM address comments |
| PF1 Title, difficulty, Top 10 | 5 | Unit selector. E2E |
| PF2 Match to 11 | 2 | Unit |
| PF3 3 s final, name entry on win, title | 5 | E2E |
| PK1 Up and Down move paddle | 4 | E2E |
| PK2 Name entry Up and Down | 5 | E2E |
| P1 4:3 field, layout, net, digits | 2, 4 | Unit rectangles. E2E aspect |
| P2 First to 11, no win-by-two | 2 | Unit |
| P3 8 segments, 7 velocities | 2 | Unit |
| P4 Speed steps at 4 and 12, reset on miss | 2 | Unit |
| P5 Top strip unreachable | 2 | Unit. Owner visual (decision 11) |
| P6 Serve toward the side that missed | 2 | Unit |
| P7 Three tones | 4 | E2E stubbed audio |
| P8 Schematic is the authority | 2 | Review: source comments |
| PD1 Difficulty changes CPU only | 3 | Unit |
| PD2 Win rates rise, Hard and Easy beatable | 3 | Unit simulation (decision 13). Owner feel check |
| PH1 Score is the margin | 5 | Unit |
| PH2 Loss never scores | 5 | Unit. E2E |
| PH3 One shared list | 5 | E2E |
| PH4 Rows show rank, initials, margin | 5 | E2E. Unit view |
| E1 Storage failure | 1, 5, 9 | As S10 |
| E2 Per-game prefixed keys | 1, 5, 9 | Unit prefix. E2E isolation |
| E3 Score 0 and loss never qualify | 1, 5, 9 | Unit. E2E |
| E4 Hidden or blur | 4, 8 | As S11 |
| E5 PAUSE label | 4, 8 | E2E |
| E6 Held keys clear on blur | 1, 4, 8 | Unit. E2E |
| E7 Letter wrap | 1 | Unit |

---

## 9. Deferred and out of scope

**Deferred (source part 9):** Space Invaders alien-pulls-the-Y animation, coin and credit display, two-player versus. Pong circuit quirks, difficulty tag on Top 10 rows, two-player mode. Both: key remap screen, music, Game Boy shell and shades, touch controls.

**Out of scope (source part 6):** cabinet art, color overlays, server-side scores, per-difficulty Pong lists, ROM bugs and circuit defects (except the 15-entry saucer wrap, which I7 asks for).

**Not added by this plan:** README entry for the new games (owner asked for no change to existing files; propose separately if wanted), shared JS file across games (S1), any new package.

---

## 10. Review log (TWO-PASS REVIEW)

`AGENTS.md` names no `TWO-PASS REVIEW` procedure. The review used two passes: pass 1 coverage against the requirements, pass 2 adversarial check of repository facts, order, size and risk.

**Pass 1: coverage**
- Flow, controls, difficulty and high-score sections had no IDs. Assigned IF, IK, PF, PK, PD, PH and E IDs. Each maps in part 8.
- I9 disagreed with ROM table 1DA3. Raised to the owner. Resolved as O2.
- IK2 ("re-fire follows the ROM") had no answer in the source. Resolved from ROM 1632-1651: no auto-refire.
- PD2 needed an objective target. Defined bots, sample size and bands (decision 13).

**Pass 1: coverage, continued**

- S5 has no default sound state. Recorded R1.
- E2 needs isolation from Tetris as well as between the two games. Added the Tetris key to the E2E checks.
- S12 footer appears in every play phase. Mapped to Phases 1, 4, 5, 8 and 9.

**Pass 2: facts, order, risk**
- Checked: no Makefile, so `npm` scripts are the test commands. New test files match the existing globs. No config change needed.
- Rejected a shared helper refactor of `tests/helpers/load-logic.mjs`: it is a Tetris file. New loader instead. Recorded as an exception to `AGENTS.md` Edits rule 6.
- Pong sources conflict on paddle height and horizontal speed. Decided with reasons (decisions 9, 10). Top strip count has no source. Named constant and owner check (decision 11).
- Space Invaders shot and saucer per-frame rates are not confirmed. Phase 7 starts with that read, with a cross-check value. Not a blocker.

**Pass 2: size and risk**

- Space Invaders rules were one large phase. Split into fleet and player (6) and shots and saucer (7).
- Temporary flows in Phases 4 and 8 let the screen be checked before the menus. Each has a removal owner.
- Pixel collision needs a bitmap in the rules. Made it explicit (decision 4) so the view does not own collision.
- R6 text was corrected to one rule (vertical velocity +1 on the first serve).

**PR review round 1 (CodeRabbit and Codex on the first commit)**

- I9 amended in `docs/arcade-requirements.md` to match O2.
- Saucer score test was one shot early. The hitting shot is counted (2.3 Saucer). Test fixed.
- Tetris `createStore` keeps a failed backend live. The arcade copy drops it on any error. Save-then-load tests added.
- Byte-identity test replaced with one behavior suite run against both files.

**PR review round 1, wording and rejected items**

- R4 now names the Midway ROM set and the skipped TAITO line.
- Evidence and decisions are grouped (AGENTS.md Output rule 05).
- Rejected: wall and point tone at 980 Hz. The source bit gives 246 Hz (2.4 Sounds).

**PR review round 2 (Codex on 85912ae)**

- Reload tests now cover both sides of each bracket edge (299/300, 1,099/1,100, 2,099/2,100, 3,099/3,100). The edges are 299 and so on, not 200, because the ROM compares the BCD hundreds byte.
- Added a non-qualifying positive score test to both game flows.
- Corrupt but well-formed saved data now counts as a storage failure (decision 14).
- `REF`, `NOVICE` and the match runner moved to the test file (decision 13).
- Remaining long lists grouped.

**PR review round 3 (Codex on d2b4263, CodeRabbit nit)**

- Saucer timer: the ROM tests for zero before it decrements, so the first saucer comes on call 1,537. Test fixed.
- Added tests: ticker per arcade file, PRESS ENTER blink, Pong 3 s final-screen hold, backend spy after a failure.

**PR review round 4 (Codex on d85137a)**

- Added tests: Pong serve keeps the ball's y and vertical velocity, per-event Pong tone frequency and length, the three-shot `shotSync` cycle, alien-shot shield erosion, recovery after a non-final player hit.
- Rejected: regrouping lists in `docs/arcade-requirements.md`. It is the owner's document, copied as is.

---

## 11. Definition of done check

Coverage:

1. Every in-scope requirement maps to a phase (part 8).
2. Every requirement has a verification method (part 8).
3. Phase order and dependencies are explicit (part 6). Pong (2-5) and Space Invaders (6-9) depend only on Phase 1 and can run in parallel.

Readiness:

4. Technical choices rest on part 2 evidence. Open reads are named with ROM addresses or source pages.
5. No engineering ambiguity blocks coding. Source conflicts are decided (decisions 9 to 11).
6. Product decisions are resolved (O1, O2). Non-blocking readings are R1 to R10.
7. A coding agent can run Phases 1 to 10 in order without redesign.

---

## 12. Implementation status

| Phase | Status |
|---|---|
| 1 to 5 (shared layer, Pong) | ✅ Done |
| 6 to 9 (Space Invaders) | ✅ Done |
| 10 (full acceptance) | ✅ Done. Owner checks open (look, sound, difficulty feel) |

**Results**
- `npm test`: 190 pass (109 Tetris). `npm run test:e2e`: all pass, Tetris specs included.
- No Tetris file changed. No network, `eval` or external resource in either game file.
- Pong CPU win rate against `REF` (300 seeded matches, one random stream per side): Easy 12.3%, Normal 53.0%, Hard 86.0%. `NOVICE` beats Easy in 93.0%.

**Changes from the plan**
- Decision 12: the CPU has a fourth parameter, `aim` (chance to return the ball upward). Error alone could not lift the CPU win rate above about 70%.
- Shared platform: the Pong final score and the Space Invaders game-over banner pause on blur and resume only when the page is both visible and focused. Play stays paused until Enter (E5).
- Shared platform: `unlock()` resumes an audio context that a browser starts suspended.
- Shared store: a corrupt saved value is removed before the fallback, so a later session can save again.
- Footer: the M key shows next to the sound state.

**ROM facts confirmed during Phases 6 and 7 (Code.html)**
- Each alien shot moves 4 px every 3 frames (80 px/s), gated by `shotSync` (0072, 04BC, 0683).
- The cannon runs only in the end-screen interrupt (007B).
- After a hit the timers run in sequence: explosion 12 × 5 ticks (02A7), respawn 0x80 (mirror 1B10), then 0x30 cannon updates before aliens fire (03B3).

**Known limit:** two presses of one key inside one 1/60 s frame count once, as in Tetris.
