# Game Boy Tetris (1989) Clone: Build Plan

**Status:** Ready for implementation. No blocking questions.
**Date:** 2026-10-15
**Source of truth:** `gameboy-tetris-requirements.md` (copy it to `docs/requirements.md` in Phase 1)
**Scope of this document:** Plan only. No code.

---

## 1. Requirements digest

**Goal:** One offline HTML file that plays Game Boy Tetris (1989, A-Type) inside a drawn Game Boy. It matches the original look and rules. It adds only 10 saved scores, a music toggle and remappable keys. Private use.

**Source structure:** The requirements file has no requirement IDs and no formal acceptance criteria. This plan assigns IDs by section. It derives each verification method from the requirement text. It adds no new requirements.

| Prefix | Source section | Topic |
|---|---|---|
| D | 2.1 | Delivery |
| F | 2.2 | Screen flow |
| G | 2.3 | Gameplay rules |
| K | 2.4 | Controls |
| H | 2.5 | High scores |
| A | 2.6 | Audio |
| L | 2.7 | Look |
| E | 5 | Edge cases |
| C | 6 | Constraints |

**Non-goals (from section 4):** B-Type, 2 PLAYER, heart mode, endings, preview hide, sound effects, counterclockwise rotation, touch input, clickable shell buttons, manual size control, server-side scores, start levels above 9.

---

## 2. Repository and reference evidence

### 2.1 Repository state
- Greenfield. No repository, no `AGENTS.md`, no existing code or tests were found.
- Inputs found: 5 screenshots in `/mnt/user-data/uploads` and the requirements file.
- All paths below are new. They are decisions, not discoveries.

### 2.2 Screenshots (visual reference)
- Sizes are 435 to 450 px wide and 407 to 416 px tall. They are scaled crops (about 2.7×), not 1:1 pixels. Trace by eye, not by pixel copy.
- They show: title (partial crop), A-TYPE level select, and play screens (score shown right-aligned with no leading zeros; LEVEL and LINES panels; next-piece box; brick walls).
- Palette sampled with a 6-color median cut. Four shades, approximate:

  | Role | Approx hex |
  |---|---|
  | Lightest (play field) | `#ffed79` |
  | Light-mid (dotted backgrounds, sky) | `#b4a448` |
  | Dark-mid (patterns, shading) | `#8e8554` |
  | Darkest (text, outlines) | `#504c41` |

  Phase 1 re-samples flat regions and fixes the four constants.
- No screenshot shows the Game Boy body. No screenshot shows name entry, Top 10, Keys, pause or game over.

### 2.3 Reference ROM disassembly (verified by reading the code)
Source: `https://github.com/vinheim3/tetris-gb-disasm` (MIT, no ROM included). Clone it outside the project as a reference. Do not copy its graphics. Art is redrawn (D3).

Verified facts (file `disasm/code/inGameFlow.s`):
- Soft drop: while only Down is held, the piece moves one row every 3 frames.
- A-Type soft-drop points: awarded once when the piece lands. Points equal the held-step counter minus 1. Confirm exact counting with a trace test.
- Line clear: rows flash in 7 phases spaced 10 frames apart. The last phase blanks the rows. Then a 13-frame wait runs before the rows shift. With no cleared rows, the next piece loads about 2 frames after lock.
- Top-out: the first lock at the spawn position is skipped once. The second ends the game.
- The original keeps high scores per start level. Requirement H1 asks for one list (see assumption I1).

Not yet read (the implementer must confirm these in the named files before coding):
- Piece shapes, rotation states and spawn positions: `disasm/data/spriteData.s` and `disasm/data/demoPieces.s`.
- Input handling and the 23/9 frame repeat: `disasm/code/bank_000.s`.
- Piece selection routine: top of `disasm/code/inGameFlow.s`.
- Name entry and level select behavior: `disasm/code/menuScreens.s`.
- Screen tile layouts (20×18 tiles): `disasm/data/layout_titleScreen.bin`, `layout_aTypeSelectionScreen.bin`, `layout_aTypeInGame.bin`.

---

## 3. Assumptions and interpretations (non-blocking)

No product decision blocks the build. These readings fill gaps. Each is cheap to change.

| ID | Reading | Basis |
|---|---|---|
| I1 | The level screen shows the first 3 entries of the single global list. It does not change with the highlighted level. | H1 and H3 describe one list. |
| I2 | "Key with a modifier" means Ctrl, Alt or Meta held. Those events are ignored. Shift alone is a normal bindable key. | E3 wording is ambiguous. This keeps browser shortcuts safe. |
| I3 | Bindings store `KeyboardEvent.code` (physical key). Labels are derived. | Works on any keyboard layout. |
| I4 | Game over shows a banner for 3 seconds. The start key skips it after 1 second. Then name entry (if qualified) or title. | F4 gives the order only. |
| I5 | The Top 10 screen exits with Esc or the bound start key. | No exit key is specified. |
| I6 | Pause shows a PAUSE label. The board stays visible. | Not specified. |
| I7 | Level select has no back action. | K1 has six actions. None is "back". |
| I8 | Name entry charset and blank-name handling follow `menuScreens.s`, without the heart glyph. | G10 makes the disassembly the authority. |
| I9 | Screens with no reference image (name entry, Top 10, Keys, pause, game over) copy the A-TYPE screen style. | L3 asks for matching style. |
| I10 | The Game Boy body has no reference image. The owner reviews it by eye. | L4. |

---

## 4. Approach and key decisions

1. **One file, no build step, no runtime dependencies.** The HTML file holds CSS, data and JS in marked sections. This is the smallest design that meets D1.
2. **Pure logic block.** Sections `CONST`, `RULES`, `DATA`, `VIEW` and `APP` are plain script with no DOM, storage or audio calls. They sit between `/* ==BEGIN LOGIC== */` and `/* ==END LOGIC== */` markers under one `GB` namespace. A Node helper extracts this block and loads it in `node:vm`. This allows unit tests with no bundler and no imports.
3. **Platform layer is thin.** One `PLATFORM` section holds canvas, `requestAnimationFrame`, keyboard events, localStorage, WebAudio and visibility handling.
4. **Fixed timestep at 59.73 Hz.** An accumulator drives `step()` once per game frame. Cap catch-up at 5 steps per animation frame. Drop the remainder after a tab restore. Timers count frames, as in the ROM.
5. **Tile-based software renderer.** A 160×144 framebuffer of 2-bit shade indexes, drawn from 8×8 tiles on a 20×18 grid (the original layout model). The renderer is pure, so unit tests can compare framebuffers. The platform layer converts the framebuffer to an `ImageData`, then scales it with nearest-neighbor.
6. **Integer scaling.** Draw to the visible canvas at the largest integer factor that fits the displayed size. CSS stretches the small remainder with `image-rendering: pixelated`. The canvas holds exactly four colors.
7. **Screen state machine.** Screens: title, levelSelect, play, gameOver, nameEntry, top10, keys. Each has `enter`, `update`, `render` and `onAction`.
8. **Action layer.** Keys map to six actions through the live binding table. Menus use the same actions (rotate acts as up). The Keys screen uses fixed arrows, Enter and Esc (E3).
9. **Storage adapter.** Keys: `gbtetris.v1.scores`, `.bindings`, `.music`. Every access is wrapped in `try/catch`. On failure it falls back to in-memory defaults and raises a `storageOk = false` flag. Every loaded value is schema-checked.
10. **Audio.** WebAudio with 2 pulse-style voices and a lookahead scheduler. The melody is an original transcription of the public-domain folk tune Korobeiniki. Do not use `songData.s` or any known game arrangement.
11. **Tests.** Required: unit tests with `node:test` (no packages). Recommended: Playwright end-to-end tests as a dev-only dependency. Neither ships in the HTML.

---

## 5. New file layout

```
gameboy-tetris.html        the deliverable (single file)
docs/requirements.md       copy of the source requirements
reference/screenshots/     the 5 supplied screenshots (original names kept)
tests/helpers/load-logic.mjs
tests/unit/*.test.mjs
tests/e2e/*.spec.mjs
package.json               devDependencies only (playwright); scripts: test, test:e2e
.gitignore
```

HTML section order: `HEAD/CSS`, `DOM shell`, `CONST`, `RULES`, `DATA`, `VIEW`, `APP`, `PLATFORM`, `BOOT`. A header comment lists the sections and the test commands.

---

## 6. Phases

### Phase 1: Skeleton, constants and test harness

**Goal**
Opening `gameboy-tetris.html` shows a blank 160×144 screen in the lightest shade. `npm test` runs and passes.

**Requirements covered**
D1, D2, D3 (start), G5 (data), G7 (data), L2

**Changes**
- Create `gameboy-tetris.html` with the section layout from part 5 and the logic markers.
- Create `tests/helpers/load-logic.mjs` (extract the marked block, run in `node:vm`, return `GB`).
- Create `package.json`, `.gitignore`, `docs/requirements.md`, `reference/screenshots/`.
- In `CONST`: four palette values (re-sampled from flat screenshot regions), the 21-entry gravity table, frame rate 59.73, repeat delays 23 and 9, soft-drop interval 3, score multipliers (40, 100, 300, 1200), caps (level 20, score 999,999).

**Implementation notes**
- No imports and no `export` inside the logic block.
- Record the sampling method in a comment next to the palette.

**Tests**
- Unit: gravity table equals the 21 values in G5. Palette has four distinct shades ordered light to dark. Constants match G7, G4 and G3 caps. The loader returns `GB`.
- E2E: the file opens from `file://` with no console errors and zero network requests.

**Acceptance criteria**
- `npm test` passes.
- The page loads with no console output and no requests.
- No server, Docker or Railway files exist in the repo.

**Dependencies**
None.

---

### Phase 2: Rules engine (pure logic)

**Goal**
A deterministic engine plays full A-Type games in Node. It follows the 1989 rules, including timing.

**Requirements covered**
G1, G2, G3, G4, G5, G6, G7, G8, G9, G10

**Changes**
In `RULES`:
- Board: 10 wide, 18 tall. Collision, move, soft drop.
- Pieces: 7 pieces with 4 rotation states each (left-handed Nintendo Rotation System). Spawn positions and orientations come from the disassembly (checked against the screenshot that shows the T preview).
- Rotation: clockwise only. A blocked rotation is refused. No wall kicks.
- Gravity: frame counter per level from the table.
- Repeat: left and right use 23 then 9 frames. Port the counter state machine from `bank_000.s`, including how the counter carries across a new piece.
- Randomizer: 3-piece queue (current, preview, hidden). Piece IDs L0 J1 I2 O3 Z4 S5 T6. Up to 3 rolls. Rolls 1 and 2 reroll when (candidate OR preview OR current) equals current. Roll 3 is kept. The random source is injected.
- Locking, row-clear flash (7 phases at 10 frames, then 13-frame wait), row shift, next-piece load.
- Lines, levels (G3) and score (G4). Score uses the pre-clear level. Cap at 999,999. Soft-drop points per the disassembly.
- Top-out: the second spawn-position lock ends the game.
- API: `createGame({ startLevel, rng })` and `step(game, input)` once per frame. `input` has held left, right and down, plus rotate edge. `step` returns events (lock, clear, levelUp, gameOver).

**Implementation notes**
- Keep every number traceable to a table or a disassembly comment with the file name.
- Use a seedable PRNG in tests only.

**Tests**
- Level-up: start 0 first level-up at 10 lines. Start 9 first level-up at 100 lines. Level never exceeds 20.
- Scoring: all four clear sizes at several levels. Level-up crossing: start 9, 96 lines, then a 4-line clear pays 1,200 × 10 = 12,000 and sets level 10. Score cap.
- Rotation: all 28 states, refusal at walls and stack, no kicks.
- Gravity: frames per row at each level (spot-check all 21).
- Soft drop: one row per 3 frames. Points trace matches the disassembly rule.
- Repeat: 23-frame delay then every 9. Carry-over across spawn.
- Randomizer: with an injected sequence, outputs match hand-computed cases. A statistical run of 1,000,000 draws gives L near 10.7%, J, I and Z near 13.7%, O, S and T near 16.1% (tolerance 0.5 points).
- Top-out: first spawn lock continues. Second ends the game.
- Fuzz: random inputs for many games never create overlapping cells or invalid state.
- Replay: 3 scripted input traces give fixed final score and board hash.

**Acceptance criteria**
- All unit tests pass.
- Each G1 to G10 item has at least one named test.
- Code comments cite the disassembly file for every timing value not listed in the requirements.

**Dependencies**
Phase 1.

---

### Phase 3: Renderer, tile art and the play screen

**Goal**
The page shows the A-Type play screen in the correct style. The engine runs with no input, so pieces fall and the game restarts after game over.

**Requirements covered**
F7, L1, L2, L3 (play screen), D3 (art in code)

**Changes**
- `DATA`: 2-bit tile data, redrawn by hand. Needs: 7 block tile designs, empty tile, flash tile, brick wall tiles, panel frame tiles, dotted-background tile, digits.
- `DATA`: bitmap font. Needs A-Z, 0-9, `.`, `-`, `:`, `©`, cursor and arrow glyphs (Phase 7 key labels and Phase 6 names need them).
- `VIEW`: framebuffer, tile blitter, text writer, play-screen renderer (walls, 10×18 field, SCORE, LEVEL, LINES, next-piece box). Right-align numbers with no leading zeros.
- `PLATFORM`: canvas, integer scaler, fixed-timestep loop (Phase 1 constants).
- Use `layout_aTypeInGame.bin` as the structural reference for tile positions.

**Implementation notes**
- Tiles are redrawn. Do not convert the disassembly PNGs (D3).
- Compare against screenshots by eye at logical scale.

**Tests**
- Unit: blitter writes the expected indexes. Text and number rendering at fixed positions. Right-alignment cases (0, 45, 2359, 999999). Golden framebuffer hashes for 3 states (empty board, mid-game, flash frame). These guard regressions only.
- E2E: sample the visible canvas. Only four distinct colors exist at 3 viewport sizes (no smoothing).

**Acceptance criteria**
- Panels, walls, text rows and next box sit within ±1 tile of the screenshot positions.
- Four shades only.
- Owner side-by-side check against the play screenshots passes (L3).
- The loop runs at the fixed rate (frame counter test with a fake clock).

**Dependencies**
Phases 1 and 2.

---

### Phase 4: Input and a playable game

**Goal**
The game is playable with the default keys. It starts at level 0 and restarts after game over (temporary).

**Requirements covered**
K2, K5, E5 (game part), E6, G7 (in play)

**Changes**
- `PLATFORM` input: listen to `keydown` and `keyup`. Use `event.code`. Ignore `event.repeat`. Ignore events with Ctrl, Alt or Meta (I2). Call `preventDefault` for bound keys and arrows.
- Map keys to the six actions with a default binding table (Left, Right, Down, Up, Enter, M). The binding table is a plain object so Phase 7 can swap it.
- Start/pause action toggles pause and shows a PAUSE label (I6).
- On `blur` and on `visibilitychange` to hidden: clear held keys and pause.
- Game over shows a GAME OVER label. The start key restarts. Phase 5 replaces this.

**Implementation notes**
- Held state comes from `keydown` and `keyup`. Hold timing comes from frame counters, not OS repeat.

**Tests**
- Unit: action mapper. Repeat events ignored. Modifier combos ignored. Blur clears held state.
- E2E: hold Left and check piece columns over time (23 then 9 pattern). Pause freezes the canvas (two screenshots equal after 1 second). Hidden tab pauses.

**Acceptance criteria**
- Left, Right, Down, Up and Enter behave as defaults in K2.
- No page scroll from arrow keys.
- Holding a key does not repeat faster than the 23/9 pattern.

**Dependencies**
Phase 3.

---

### Phase 5: Screen flow, title and level select

**Goal**
The full flow runs: title, level select, game, game over, title.

**Requirements covered**
F1, F2, F3, F4 (flow without names), K3 (menus), L3 (title and level select), D3

**Changes**
- `APP`: screen state machine and transitions.
- Title screen: TETRIS logo, skyline artwork with domes and sun, `1 PLAYER` only, `©1989 Nintendo`. The right-hand `2 PLAYER` slot stays empty. Use `layout_titleScreen.bin` for tile positions. The title screenshot is a partial crop, so fill the missing parts from the layout.
- Level select: `A-TYPE` header, LEVEL grid 0 to 4 and 5 to 9, cursor highlight, TOP-SCORE panel with 3 dotted rows (data arrives in Phase 6). Move with bound left, right, down and rotate (as up). Start begins the game at the chosen level.
- Game over: banner (I4), then title.
- Remove the Phase 4 restart stub.

**Implementation notes**
- Title artwork is the largest art item. Time-box it. L3 and section 3 of the requirements allow non-pixel-exact results.

**Tests**
- Unit: level-select navigation over all cells. Transition table (every screen and action). Golden framebuffers for title and level select.
- E2E: Enter, then pick level 5, Enter. The play screen shows LEVEL 5. After game over the flow returns to the title.

**Acceptance criteria**
- Title shows no `2 PLAYER` text.
- Starting at level N shows N and uses level N gravity.
- Owner side-by-side check against title and A-TYPE screenshots passes.

**Dependencies**
Phase 4.

---

### Phase 6: Storage and high scores

**Goal**
Scores persist across reloads. Name entry, the Top 10 screen and the top-3 panel work.

**Requirements covered**
H1, H2, H3, H4, F4, F5, E1, E2, E4

**Changes**
- `PLATFORM`: storage adapter (part 4, item 9). Surface `storageOk` to the page as a plain notice element reading "Scores not saved" (Phase 9 styles it).
- `APP`: score list logic. Qualify when score is above 0 and either fewer than 10 entries exist or the score beats the 10th. Ties rank below older equal scores. Keep 10 entries.
- Name entry screen: up to 6 characters. Up and Down change the character. Left and Right move the cursor. Start confirms (I8).
- Top 10 screen: hotkey H on the title only. Esc or start exits (I5). Empty rows show dotted lines.
- Level select panel shows the first 3 entries (I1).
- Game over flow: banner, then name entry if qualified, then save, then title.

**Implementation notes**
- Validate loaded data: array of at most 10 entries, name string of valid characters up to 6, integer score from 0 to 999,999. Drop bad entries. Fall back to an empty list on any parse error.

**Tests**
- Unit: qualification matrix (score 0, 9 entries, 10 entries, equal to 10th, tie order). Insertion and truncation. Corrupt JSON, wrong types, negative scores, 15 entries. Fake storage that throws on read, write and quota.
- E2E: reach game over with a stubbed `Math.random`, enter a name, reload, see the score in Top 10 and in the top-3 panel. H works on the title and does nothing on other screens. With storage blocked (init script), the game works and the notice shows.

**Acceptance criteria**
- Scores survive reload.
- Storage failure never throws and never blocks play (E1).
- Keys use the `gbtetris.v1.` prefix so other local files do not collide.

**Dependencies**
Phase 5.

---

### Phase 7: Keys screen and remapping

**Goal**
Players can remap all six actions. Bindings persist.

**Requirements covered**
K1, K3, K4, F6, E3

**Changes**
- `APP`: binding model (six actions, one code each). Validation: reject duplicates, reject reserved keys (H, K, Esc), ignore Ctrl, Alt and Meta combos (I2).
- Keys screen: hotkey K on the title only. Rows for the six actions with key labels. A final RESET row. Navigation is fixed: arrows, Enter to capture, Esc to leave or cancel. While capturing, the next key binds (Esc cancels). Show short messages (for example KEY IN USE, RESERVED KEY).
- Label formatter: arrows to words, `KeyX` to `X`, `DigitN` to `N`, others uppercased and cut to 8 characters.
- Persist through the Phase 6 adapter. Validate on load: six unique, non-reserved codes. Otherwise use defaults.
- The Phase 4 input layer reads the live table.

**Implementation notes**
- Fixed navigation on this screen prevents lockout from bad bindings.

**Tests**
- Unit: validation matrix. Load validation (missing action, duplicate, reserved). Label table.
- E2E: rebind rotate to Space, reload, Space rotates and Up no longer does. Duplicate rejected. RESET restores defaults. K does nothing outside the title. Menus follow the new bindings.

**Acceptance criteria**
- All six actions remap and persist.
- No binding can break navigation of the Keys screen.

**Dependencies**
Phases 4, 5 and 6.

---

### Phase 8: Music

**Goal**
Original 8-bit music plays during play. The toggle works everywhere.

**Requirements covered**
A1, A2, A3, A4, A5, E5 (music part)

**Changes**
- `PLATFORM` audio engine: create the `AudioContext` on the first keydown (A5). Two pulse-style oscillator voices with simple envelopes through one master gain. Lookahead scheduler (about 25 ms timer, about 100 ms lookahead).
- `DATA`: melody and bass as note arrays (pitch, beats). Original transcription of the folk tune. Add a provenance comment.
- Integration: start when a game starts. `ctx.suspend()` on pause and on hidden or blur. `resume()` on return. Stop and reset on game over. Silent on title and other screens.
- Toggle: the music action works on every screen through an app-level route. Muting sets master gain to 0. State persists through the Phase 6 adapter.
- Failure: if WebAudio is missing or throws, the game still runs and the toggle still changes state.

**Implementation notes**
- Keep the sequencer logic (note timeline, loop wrap) in the pure block so it can be tested with a fake clock.

**Tests**
- Unit: note data valid (pitch range, positive durations). Loop length closes. Scheduler gives exact event times across several loop wraps with no drift. Toggle and lifecycle state machine.
- E2E with a stubbed `AudioContext`: no oscillators before the first key. None on the title. Oscillators start after a game starts. None while toggled off. State persists after reload. Suspend on pause.
- Manual: listen for tempo and tone.

**Acceptance criteria**
- Music matches A3 on every screen.
- No audio before the first keypress.
- Owner listening check passes.

**Dependencies**
Phases 4, 5, 6 and 7.

---

### Phase 9: Device shell, fit-to-window and full acceptance

**Goal**
The game sits inside a classic gray Game Boy that scales to any window. The legend and notice are visible outside the screen.

**Requirements covered**
L4, L5, E7, C1, C2, D1 (full-flow check)

**Changes**
- DOM and CSS: Game Boy body (bezel, screen opening, power LED, label text, wordmark, D-pad, A and B, Start and Select, speaker slots). All decorative (`pointer-events: none`). Keep the title, ©1989 Nintendo line and shell as in C1.
- Layout: `html, body { height: 100%; overflow: hidden }`. Device size comes from a CSS variable computed from the viewport minus the legend height. Fixed aspect ratio. `ResizeObserver` feeds the canvas integer scaler.
- Legend strip (real text, outside the screen): H for scores, K for keys, the six current bindings, music ON or OFF. Style the Phase 6 "Scores not saved" notice here. Update on binding and music changes.
- Canvas gets an `aria-label`.

**Implementation notes**
- Chrome is the primary target. Use only `ResizeObserver`, `AudioContext`, `localStorage` and `KeyboardEvent.code`.

**Tests**
- E2E at 1920×1080, 1366×768, 800×600 and 360×640: no scrollbars (`scrollWidth <= clientWidth` and same for height). Device aspect ratio equal across sizes (within 1%). Canvas has four colors only. Legend and notice are inside the viewport.
- E2E: legend updates after a remap and after a music toggle.
- E2E full flow: title, level select, play, game over, name entry, H, K. Zero network requests. Clean console.
- Manual owner checklist: shell recognizable as a classic Game Boy, screen fidelity, music, key feel.

**Acceptance criteria**
- All E2E checks pass.
- Owner review passes for L3, L4 and A2.
- Every row of the traceability table shows its verification done.

**Dependencies**
Phases 6, 7 and 8.

---

## 7. Cross-cutting work (each item has an owner phase)

| Concern | Decision | Phase |
|---|---|---|
| Privacy and security | No network, no external resources, no `eval`. E2E asserts zero requests. | 1 and 9 |
| Storage namespace | Prefixed keys. Data is per browser profile and file location (E2). | 6 |
| Compatibility | Modern evergreen desktop browsers. Chrome primary (C2). | 9 |
| Accessibility | Not required. Legend is real text. Canvas has a label. | 9 |
| Deployment | None. Open the file. Railway is not used. | 1 |
| Rollback | Version control only. | None |
| Documentation | Header comment in the HTML. `docs/requirements.md`. No separate README. | 1 |
| Cleanup | Remove the Phase 4 restart stub. | 5 |

---

## 8. Requirements traceability

| ID | Requirement | Phase | Verification |
|---|---|---|---|
| D1 | One standalone HTML file. No server, external files or network calls. | 1, 9 | E2E: loads from `file://`, zero requests |
| D2 | Railway not used. | 1 | Review: no server or deploy files |
| D3 | Assets inline. Art in code. Music synthesized. | 3, 5, 8 | E2E zero requests. Review: no asset files |
| F1 | Title content (logo, artwork, 1 PLAYER, ©1989 Nintendo). | 5 | Golden test. Owner visual check |
| F2 | Level select with levels 0 to 9 and top-3 panel. | 5, 6 | Unit navigation. Owner visual check |
| F3 | Start begins the game at the chosen level. | 5 | E2E: LEVEL shows chosen value |
| F4 | Game over goes to name entry if qualified, then title. | 5, 6 | E2E |
| F5 | H opens Top 10 from the title only. | 6 | E2E |
| F6 | K opens Keys from the title only. | 7 | E2E |
| F7 | Play screen elements (SCORE, LEVEL, LINES, next box, walls). | 3 | Framebuffer unit tests. Owner visual check |
| G1 | 10×18 field, 1 preview, no hold, no hard drop. | 2 | Unit |
| G2 | Left-handed NRS, no kicks, refused rotation, clockwise only. | 2 | Unit (28 states) |
| G3 | Levels 0 to 9 start. Level-up rule. Max 20. | 2 | Unit |
| G4 | Score table at pre-clear level. Cap. Soft-drop points. | 2 | Unit including the 12,000 case |
| G5 | Gravity table. 59.73 Hz fixed timestep. | 1, 2, 3 | Unit table check. Fake-clock loop test |
| G6 | Soft drop one row per 3 frames. | 2 | Unit |
| G7 | Repeat 23 then 9 frames. | 2, 4 | Unit. E2E timing |
| G8 | Biased randomizer. | 2 | Unit sequence cases. Statistical test |
| G9 | Top-out on second spawn lock. | 2 | Unit |
| G10 | Disassembly is the authority for other numbers. | 2 | Review: file citations in comments |
| K1 | Six remappable actions. | 7 | E2E remap of each action |
| K2 | Default keys. | 4 | Unit. E2E |
| K3 | Menus and name entry use bound keys. | 5, 6, 7 | E2E after a remap |
| K4 | Bindings saved in localStorage. | 7 | E2E reload |
| K5 | Keyboard only. | 4 | Review: no pointer handlers on shell |
| H1 | Top 10 with name and score in localStorage. | 6 | Unit. E2E reload |
| H2 | Name entry, 6 characters, arrow controls, start confirms. | 6 | Unit. E2E |
| H3 | Top 3 on level screen. Top 10 on its own screen. | 6 | E2E |
| H4 | Empty rows show dotted lines. | 6 | Golden test |
| A1 | Music only. 8-bit style. Loops. | 8 | Unit loop test. Owner listening check |
| A2 | Original synthesized arrangement of Korobeiniki. | 8 | Review: provenance comment. Owner listening check |
| A3 | Plays in play. Pauses on pause. Stops on game over. Silent on title. | 8 | E2E with stubbed AudioContext |
| A4 | Toggle works on every screen. State saved. | 8 | E2E |
| A5 | Audio starts after the first keypress. | 8 | E2E |
| L1 | 160×144 logical screen. Pixel-sharp scaling. | 3, 9 | E2E four-color check |
| L2 | Four shades from the screenshots. | 1, 3 | Unit. Owner visual check |
| L3 | Tiles, walls and panels match the screenshots. | 3, 5 | Position check (±1 tile). Owner side-by-side |
| L4 | CSS or SVG Game Boy body. Decorative buttons. Classic gray. | 9 | Owner review |
| L5 | Device fits any window. Aspect kept. No scrollbars. | 9 | E2E viewport matrix |
| E1 | Storage failure falls back and shows "Scores not saved". | 6, 9 | Unit fake storage. E2E blocked storage |
| E2 | Data is tied to browser profile and file location. | 6 | E2E reload. Prefixed keys |
| E3 | Remap rules and Keys screen navigation. | 7 | Unit matrix. E2E |
| E4 | Qualifying score and tie rules. | 6 | Unit matrix |
| E5 | Hidden tab or blur pauses game and music. | 4, 8 | E2E |
| E6 | OS key repeat ignored. | 4 | Unit. E2E |
| E7 | Legend outside the screen with H, K, bindings and music state. | 9 | E2E |
| C1 | Title, notice and shell stay. Private use only. | 5, 9 | Owner review |
| C2 | Modern evergreen desktop browser. Chrome primary. | 9 | E2E on Chromium |

---

## 9. Deferred and out of scope

Deferred (from the requirements): sound effects, B-Type, endings, touch controls, manual size control, server-side scores, neutral title for public release.

Out of scope (non-goals): 2 PLAYER, heart mode, preview hide, counterclockwise rotation, clickable shell buttons, start levels above 9.

Not added by this plan: back navigation on level select, per-level score lists, any README.

---

## 10. Review log (two passes)

No `AGENTS.md` or `TWO-PASS REVIEW` definition was available. The review used two passes: coverage against the requirements, then an adversarial check of order, size and assumptions.

**Pass 1: coverage**
- E2 (saved-data scope) had no owner. Assigned to Phase 6 (prefixed keys, reload test).
- E7 (legend) needs bindings and music state. Moved to Phase 9. Phase 6 only raises the notice flag.
- A4 (toggle on every screen) needed a global route. Added to Phase 8.
- L3 had no objective check. Added the four-color check, ±1 tile position check and owner side-by-side.
- Key labels and names need font glyphs. Moved glyph coverage into Phase 3.
- The source has no IDs or acceptance criteria. Added an ID scheme and derived verification. Added no new requirements.

**Pass 2: order, size and risk**
- Input was first in Phase 3. Moved to Phase 4 so Phase 3 can be checked by eye.
- Pure logic needs no DOM to be testable in Node. Added the marked block and loader.
- The title is a partial crop. Added the layout file as reference and a time-box.
- "Key with a modifier" was ambiguous. Recorded as I2.
- The repeat counter carry-over is a real 1989 behavior. Added to Phase 2 under G10.
- Avoided a final cleanup phase. The one cleanup item has an owner (Phase 5).

---

## 11. Definition of done check

1. Every in-scope requirement maps to a phase (part 8).
2. Every requirement has a verification method (part 8).
3. Phase order and dependencies are explicit (part 6).
4. Technical choices rest on the evidence in part 2. Items not yet read are named with file paths.
5. No engineering ambiguity blocks coding. Open details have a named source file.
6. No unresolved product decision. Non-blocking readings are listed as I1 to I10.
7. A coding agent can run Phases 1 to 9 in order without redesign.

---

## 12. Implementation status

Updated at the end of each phase. Review method: `AGENTS.md` has no `TWO-PASS REVIEW` section, so each phase uses the two passes from part 10 (pass 1: acceptance criteria and coverage; pass 2: adversarial check). Findings follow `AGENTS.md` Edits rule 3: in-task findings are fixed in the phase; out-of-task findings are listed below as proposals.

| Phase | Status | Notes |
|---|---|---|
| 1 | ✅ Done | See 12.1 |
| 2 | ✅ Done | See 12.2 |
| 3 | ✅ Done (owner check open) | See 12.3 |
| 4 | ✅ Done | See 12.4 |
| 5 | Not started | |
| 6 | Not started | |
| 7 | Not started | |
| 8 | Not started | |
| 9 | Not started | |

### 12.1 Phase 1

- Done: `gameboy-tetris.html` skeleton with section markers and logic markers. `CONST` holds palette, gravity, timing, scores, caps. Loader `tests/helpers/load-logic.mjs`. `package.json` (Playwright 1.56.1, dev only). Requirements copied to `docs/requirements.md`.
- Palette sampled from flat screenshot regions: `#ffed79`, `#b4a446`, `#847947`, `#4e4e4e` (method in a `CONST` comment).
- Deviation: the screenshots arrived without file names. They are stored under descriptive names in `reference/screenshots/`.
- Validation: `npm test` 7/7 pass. `npm run test:e2e` 2/2 pass (no console output, zero requests, lightest shade).
- Blockers: none.

### 12.2 Phase 2

- Done: `RULES` is a frame-exact port of `GameState00_InGameMain` plus the VBlank row work. API: `createGame({ startLevel, rng })`, `step(game, input)` returning `lock`, `clear`, `levelUp`, `gameOver`, `spawn` events.
- Confirmed in the disassembly (the plan listed these as not yet read):
  - Piece cells: `spriteData.s` `SpriteTiles_00..1b`. Rotate (A button) is state minus 1, which is clockwise.
  - Spawn: grid cell (r, c) maps to field row r-1, column c+3 (`gfx.s` `GetScreen0AddressOfPieceSquare`).
  - Gravity table in `bank_000.s` `$1b06` holds values minus 1 (counter reload). Periods equal requirement G5.
  - Repeat counter `hStickyButtonCounter`: 23 on press, 9 on repeat, 1 after a blocked move, 23 when released. Not reset by a new piece.
  - Soft drop: after a lock, a held Down needs a new press (`wCanPressDownToMakePieceFall`). Holding Left or Right with Down stops soft drop. Points = rows dropped.
  - Score is added during row copy state 5, level check at row 3 copy, so the pre-clear level applies.
- ROM quirks kept on purpose (G10): rows 0 and 1 are never checked for completion; a spawned piece can overlap the stack; a cell locked in hidden row -1 stays there.
- Unverified assumptions (comments in code): hidden piece and repeat counter start values at game start; a hidden piece's gravity move has no effect. Verify by tracing the ROM in an emulator debugger.
- Validation: `npm test` 45/45 pass. Tests: every G1 to G10 item, 1,000,000-draw randomizer share, fuzz (40 random and 5 bot games), 3 bot replays with golden score and board hash.
- Blockers: none.

### 12.3 Phase 3

- Done: `DATA` holds hand-drawn block tiles (keyed by ROM tile id), brick wall, panel frames, a 7x7 bold font (A-Z, 0-9, `. - : ! ©`, multiply sign, cursor, arrows, dotted blank) and the play layout as text. `VIEW` has framebuffer, blitter, text, right-aligned numbers and the play screen. `APP.createTicker` is the fixed-timestep accumulator (cap 5, backlog dropped). `PLATFORM` converts the framebuffer to the canvas at an integer factor.
- The page now runs an attract game with no input that restarts after game over.
- Validation: `npm test` 56/56 pass. `npm run test:e2e` 4/4 pass (four colors only at 1920x1080, 1024x700 and 360x640).
- Open: owner side-by-side check of the play screen against the screenshots (L3).
- Blockers: none.

### 12.4 Phase 4

- Done: `APP.createInput` maps `KeyboardEvent.code` to the six actions through a live binding table (`DEFAULT_BINDINGS`). It ignores OS repeat events and Ctrl, Alt or Meta combos (I2). It prevents default for bound keys and all arrows. A tap inside one frame still counts as held for that frame. `APP.createPlay` runs the game: Start toggles PAUSE (I6), blur or a hidden tab clears keys and pauses, and GAME OVER plus Start restarts (temporary stub, removed in Phase 5).
- As in the ROM (`bank_000.s` `$1bce`), the unpause frame runs game logic.
- `window.gbApp` is a read-only handle for E2E tests.
- Validation: `npm test` 68/68 pass. `npm run test:e2e` 11/11 pass, 55/55 with `--repeat-each 5`. Hold Left gives moves 23 then 9 frames apart in the browser.
- Blockers: none.
