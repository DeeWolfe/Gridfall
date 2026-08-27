# Card art sources

Drop an image here named after a card id — `rifle.png`, `medic.jpg` — and run
`npm run gen:art` (needs Pillow: `pip install pillow`).

The tool crops to the artwork, flood-fills the white background away from the
borders (whites *inside* the art survive), feathers the edge, downscales to
card resolution and embeds the result in `src/content/card-art.js`. Cards
without art keep their procedural sigil.

Source images are committed here so the art can be regenerated; the generated
module is what the game actually ships.
