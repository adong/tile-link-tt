/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.TL_TITLE, // the name lives in js/title.js
  button: { top: 'var(--kh-top)' }, // index.html moves it (and the language button) to a corner on tall screens
  keys: [
    ['pick a tile, then its partner', '← ↑ → ↓ then Enter or Space'],
    ['shuffle the tiles', 'X'],
    ['call your brother (2 players: high five)', 'T'],
    ['this level again', 'R'],
    ['pause · sound', 'P or Esc · M'],
    ['2 players: Teddy · Tommy', 'W A S D + Space · ← ↑ → ↓ + Enter'],
    ['menu: play · the story', 'Enter · B'],
    ['menu: 1 player · race · 2 players', '1 · 2 · 3'],
    ['menu: Teddy or Tommy · level', 'W · L'],
    ['menu: the tiles · the starting level', '← → · ↑ ↓'],
  ],
  note: 'Find two tiles that match. Join them with a line that turns two times at most, through empty spaces or round the outside of the board. Clear every tile!',
  touch: 'Tap a tile, then its partner. 🔀 mixes the tiles. Tap your brother\'s face (bottom right) and he shows you a pair.',
});
Kit.lang.setup({ button: { top: 'var(--kl-top)' } });
