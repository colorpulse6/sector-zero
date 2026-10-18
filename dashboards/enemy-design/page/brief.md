# Enemy design review 001

Manual design exploration, 2026-10-18. Owner: Codex. Decision owner: Nic.

Open index.html directly, serve this folder with any static server, or open the registered Cerebro dashboard. No installation, network access, scheduled job, saved settings or game dependency is required. Keep assets alongside the HTML.

Three AI-generated static proposals interpret the existing industrial / organic hostile style guide in docs/assets/prompts/doom/00-master-style-guide.md and the role directions in docs/assets/fps-enemy/README.md. This is concept approval material, not an animated atlas or gameplay capture. The existing hostile fallback-front.png is copied unchanged as the baseline. Generated PNGs are copied from the image-generation output without modifying the originals.

The background, size and silhouette controls only affect this page. Character light is baked into each image; background changes do not relight it. Equal image-box heights are for comparison and do not establish in-game proportions. The distance row fits each source inside a 72 x 48 CSS-pixel box (64 x 48 on narrow screens), so transparent margins affect occupied height. The page works directly from disk; data.json is a metadata manifest, not a fetched runtime dependency.

Nic approved all three designs on 2026-10-18. No approval state can be changed by this page. Runtime verification is in progress. The art designer then produces clean directional views and animation frames; Codex integrates one enemy and verifies it in actual gameplay before expanding to the rest. Alpha edges, consistent anatomy, foot alignment, firing tells, atlas budget and combat readability remain production checks.

No game code, save data or runtime assets are changed by this bundle.
