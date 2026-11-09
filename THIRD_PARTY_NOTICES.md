# Third-party notices

This inventory covers the Marinara-Ensemble source checkout based on Marinara Engine commit `fc0333c3fe978cda5e0b919bd6faec985901704e`, the resolved Windows npm install, and the browser bundles built from it. Reviewed on 2026-11-08. The fork changes for P0, M1 and M2 do not add dependencies, fonts, artwork or tracked executable files. This review does not authorize a separate binary release or hosted service.

## Upstream source and assets

[Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine) is by Pasta-Devs and its contributors. The [GNU AGPL version 3](LICENSE), upstream source notices, [attributions](README.md#社区与致谢) and [trademark policy](TRADEMARKS.md) are preserved. The tracked Windows launcher is inherited from that same commit; its [source and build script](win/launcher/) are present. No new launcher, installer, APK, container image, model weights or compiled application bundles are included in this source handoff.

| Component | Version or provenance | License and credits |
| --- | --- | --- |
| Provider icon SVGs from [Lobe Icons](https://github.com/lobehub/lobe-icons) | `@lobehub/icons-static-svg` 1.95.1 | MIT, Copyright (c) 2023 LobeHub. Original [license](packages/client/src/assets/provider-icons/LICENSE) and [per-icon provenance](packages/client/src/assets/provider-icons/README.md) are retained. |
| Provider owner logos and redrawn marks | Inherited at `fc0333c`; see the [provider icon inventory](packages/client/src/assets/provider-icons/README.md) | llama.cpp's source icon is identified there as MIT. Other brand marks, including KoboldCpp, SwarmUI, AI Horde, ArliAI and LinkAPI, have identified sources; separate redistribution permission for those logo files and marks was not established. The Lobe MIT notice does not cover them. |
| Built-in game music and effects | Inherited at `fc0333c`; see the [track and pack credits](packages/server/src/assets/default-game-assets/CREDITS.md) | Publisher pages identify the named works by [cynicmusic](https://opengameart.org/users/cynicmusic), [pauliuw](https://opengameart.org/content/the-field-of-dreams), [RandomMind](https://opengameart.org/content/medieval-the-old-tower-inn), [artisticdude](https://opengameart.org/content/rpg-sound-pack) and [Kenney](https://kenney.nl/assets/rpg-audio) as CC0. Credits are retained. For ambient audio whose credit only names a library or category, individual source files and authors could not be independently verified. |
| Overworld tiles, board packs, sample avatar and seasonal art | Inherited at `fc0333c` | Upstream describes the [overworld tiles](packages/server/src/assets/overworld-tiles/README.md) and [board packs](packages/server/src/assets/board-packs/README.md) as its own work. Provenance for the [sample avatar](packages/client/public/sprites/avatar-demo/README.md) and [seasonal art](packages/client/public/seasonal/) remains in the original folders. |
| Upstream logos and screenshots | Inherited at `fc0333c` | The screenshots are identified as upstream documentation. Project marks are governed separately by [TRADEMARKS.md](TRADEMARKS.md); the source license does not give a separate branding grant. |
| Gradle and Android Gradle Plugin | Gradle 9.8.2; AGP 9.5.0 | Published [Gradle](https://gradle.org/license/) and [Android Gradle Plugin](https://android.googlesource.com/platform/tools/base/+/mirror-goog-studio-master-dev/build-system/gradle-core/src/main/java/com/android/build/gradle/BasePlugin.kt) sources carry Apache-2.0. They are build inputs obtained separately. The pinned Android binaries and their packaging notices were outside this source audit. |

## Distribution boundaries and open items

- The [root AGPL](LICENSE) governs the fork's source and the upstream program. Keep the original notices, mark the modifications and date, and review AGPL sections 5, 6 and 13 for the source and build instructions owed with a distributed executable or modified network service. Component licenses still apply to their own files. Keep applicable MIT, ISC, BSD, Apache and NOTICE text with redistributed components. For dual-licensed DOMPurify, the package includes Apache-2.0 and MPL-2.0; both original texts are retained.
- The server build transpiles source without bundling npm modules. `@anthropic-ai/claude-agent-sdk` and the platform package at 0.3.306 are installed separately, are marked all rights reserved, and are subject to [Anthropic's published terms](https://code.claude.com/docs/en/legal-and-compliance). They are not covered by the project's AGPL. The build and lockfile are not permission to redistribute Anthropic's SDK or binary. Review the inherited integration against the publisher's conditions before packaging or operating it for others.
- Sharp's installed native packages use Apache-2.0 with LGPL-3.0-or-later components (and MIT for the installed WASM package). If distributing these binaries, retain their full original notices and verify the applicable corresponding source and replacement/relinking obligations. Audit the actual platform artifact before distribution.
- Share Tech Mono is OFL-1.1. Its original copyright, Reserved Font Name and license are included below. See the [SIL webfont guidance](https://openfontlicense.org/ofl-faq/) for redistribution.
- Public, independently downloadable services, agents, providers, fonts and model files may impose their own terms. Their software or weights are not relicensed by this repository. No GPL-2.0-only component was identified in the reviewed Windows npm or rendered browser inventory. This is not a finding about packages on other platforms or a future binary release.
- Outstanding asset clearance: verify the individual ambient tracks and owner-logo permissions where the upstream inventory does not identify a grant. Retain copyright notices and obtain any needed permission before using upstream marks as standalone product branding. Do not describe these items as cleared on the strength of this inventory.

## Browser and guest bundles

The production bundler reported 35 package/version pairs with rendered JavaScript modules. The table also includes the CSS-imported webfont and the Workbox 7.4.1 runtime family used to generate the service worker. The linked files retain the publisher's license and copyright text. A package can appear here and in the direct inventory below.

| Component and source | Version | Delivery | License | Original notices |
| --- | --- | --- | --- | --- |
| [`@dnd-kit/accessibility`](https://www.npmjs.com/package/@dnd-kit/accessibility/v/3.1.1) | 3.1.1 | client | MIT | [`LICENSE`](LICENSES/npm/dnd-kit__accessibility@3.1.1/LICENSE) |
| [`@dnd-kit/core`](https://www.npmjs.com/package/@dnd-kit/core/v/6.3.1) | 6.3.1 | client | MIT | [`LICENSE`](LICENSES/npm/dnd-kit__core@6.3.1/LICENSE) |
| [`@dnd-kit/utilities`](https://www.npmjs.com/package/@dnd-kit/utilities/v/3.2.2) | 3.2.2 | client | MIT | [`LICENSE`](LICENSES/npm/dnd-kit__utilities@3.2.2/LICENSE) |
| [`@fontsource/share-tech-mono`](https://www.npmjs.com/package/@fontsource/share-tech-mono/v/5.3.0) | 5.3.0 | client webfont | OFL-1.1 | [`LICENSE`](LICENSES/npm/fontsource__share-tech-mono@5.3.0/LICENSE) |
| [`@pixiv/three-vrm`](https://www.npmjs.com/package/@pixiv/three-vrm/v/3.5.5) | 3.5.5 | client | MIT | [`LICENSE`](LICENSES/npm/pixiv__three-vrm@3.5.5/LICENSE) |
| [`@pixiv/three-vrm-animation`](https://www.npmjs.com/package/@pixiv/three-vrm-animation/v/3.5.5) | 3.5.5 | client | MIT | [`LICENSE`](LICENSES/npm/pixiv__three-vrm-animation@3.5.5/LICENSE) |
| [`@takahirox/three-mmd`](https://www.npmjs.com/package/@takahirox/three-mmd/v/0.1.2) | 0.1.2 | client | MIT | [`LICENSE`](LICENSES/npm/takahirox__three-mmd@0.1.2/LICENSE) |
| [`@tanstack/query-core`](https://www.npmjs.com/package/@tanstack/query-core/v/5.105.1) | 5.105.1 | client | MIT | [`LICENSE`](LICENSES/npm/tanstack__query-core@5.105.1/LICENSE) |
| [`@tanstack/react-query`](https://www.npmjs.com/package/@tanstack/react-query/v/5.105.1) | 5.105.1 | client | MIT | [`LICENSE`](LICENSES/npm/tanstack__react-query@5.105.1/LICENSE) |
| [`clsx`](https://www.npmjs.com/package/clsx/v/2.1.1) | 2.1.1 | client, guest | MIT | [`license`](LICENSES/npm/clsx@2.1.1/license) |
| [`dompurify`](https://www.npmjs.com/package/dompurify/v/3.4.17) | 3.4.17 | client | (MPL-2.0 OR Apache-2.0) | [`LICENSE`](LICENSES/npm/dompurify@3.4.17/LICENSE), [`LICENSE-MPL`](LICENSES/npm/dompurify@3.4.17/LICENSE-MPL) |
| [`framer-motion`](https://www.npmjs.com/package/framer-motion/v/13.5.1) | 13.5.1 | client | MIT | [`LICENSE.md`](LICENSES/npm/framer-motion@13.5.1/LICENSE.md) |
| [`framer-motion`](https://www.npmjs.com/package/framer-motion/v/14.5.0) | 14.5.0 | client | MIT | [`LICENSE.md`](LICENSES/npm/framer-motion@14.5.0/LICENSE.md) |
| [`html-parse-stringify`](https://www.npmjs.com/package/html-parse-stringify/v/4.0.1) | 4.0.1 | client | MIT | [`LICENSE`](LICENSES/npm/html-parse-stringify@4.0.1/LICENSE) |
| [`i18next`](https://www.npmjs.com/package/i18next/v/26.5.11) | 26.5.11 | client | MIT | [`LICENSE`](LICENSES/npm/i18next@26.5.11/LICENSE) |
| [`lucide-react`](https://www.npmjs.com/package/lucide-react/v/1.66.0) | 1.66.0 | client, guest | ISC | [`LICENSE`](LICENSES/npm/lucide-react@1.66.0/LICENSE) |
| [`mesh-avatar`](https://www.npmjs.com/package/mesh-avatar/v/0.2.1) | 0.2.1 | client | MIT | [`LICENSE`](LICENSES/npm/mesh-avatar@0.2.1/LICENSE) |
| [`mmd-parser`](https://www.npmjs.com/package/mmd-parser/v/1.1.4) | 1.1.4 | client | MIT | [`LICENSE`](LICENSES/npm/mmd-parser@1.1.4/LICENSE) |
| [`motion-dom`](https://www.npmjs.com/package/motion-dom/v/13.5.1) | 13.5.1 | client | MIT | [`LICENSE.md`](LICENSES/npm/motion-dom@13.5.1/LICENSE.md) |
| [`motion-dom`](https://www.npmjs.com/package/motion-dom/v/14.5.0) | 14.5.0 | client | MIT | [`LICENSE.md`](LICENSES/npm/motion-dom@14.5.0/LICENSE.md) |
| [`motion-utils`](https://www.npmjs.com/package/motion-utils/v/13.5.0) | 13.5.0 | client | MIT | [`LICENSE.md`](LICENSES/npm/motion-utils@13.5.0/LICENSE.md) |
| [`motion-utils`](https://www.npmjs.com/package/motion-utils/v/14.1.1) | 14.1.1 | client | MIT | [`LICENSE.md`](LICENSES/npm/motion-utils@14.1.1/LICENSE.md) |
| [`nanoid`](https://www.npmjs.com/package/nanoid/v/3.3.20) | 3.3.20 | client | MIT | [`LICENSE`](LICENSES/npm/nanoid@3.3.20/LICENSE) |
| [`picocolors`](https://www.npmjs.com/package/picocolors/v/1.1.1) | 1.1.1 | client | ISC | [`LICENSE`](LICENSES/npm/picocolors@1.1.1/LICENSE) |
| [`postcss`](https://www.npmjs.com/package/postcss/v/8.5.32) | 8.5.32 | client | MIT | [`LICENSE`](LICENSES/npm/postcss@8.5.32/LICENSE) |
| [`react`](https://www.npmjs.com/package/react/v/19.3.1) | 19.3.1 | client, guest | MIT | [`LICENSE`](LICENSES/npm/react@19.3.1/LICENSE) |
| [`react-dom`](https://www.npmjs.com/package/react-dom/v/19.3.1) | 19.3.1 | client, guest | MIT | [`LICENSE`](LICENSES/npm/react-dom@19.3.1/LICENSE) |
| [`react-i18next`](https://www.npmjs.com/package/react-i18next/v/17.1.0) | 17.1.0 | client | MIT | [`LICENSE`](LICENSES/npm/react-i18next@17.1.0/LICENSE) |
| [`scheduler`](https://www.npmjs.com/package/scheduler/v/0.28.0) | 0.28.0 | client, guest | MIT | [`LICENSE`](LICENSES/npm/scheduler@0.28.0/LICENSE) |
| [`sonner`](https://www.npmjs.com/package/sonner/v/2.0.8) | 2.0.8 | client | MIT | [`LICENSE.md`](LICENSES/npm/sonner@2.0.8/LICENSE.md) |
| [`tailwind-merge`](https://www.npmjs.com/package/tailwind-merge/v/3.7.0) | 3.7.0 | client, guest | MIT | [`LICENSE.md`](LICENSES/npm/tailwind-merge@3.7.0/LICENSE.md) |
| [`three`](https://www.npmjs.com/package/three/v/0.186.1) | 0.186.1 | client | MIT | [`LICENSE`](LICENSES/npm/three@0.186.1/LICENSE) |
| [`use-sync-external-store`](https://www.npmjs.com/package/use-sync-external-store/v/1.7.0) | 1.7.0 | client | MIT | [`LICENSE`](LICENSES/npm/use-sync-external-store@1.7.0/LICENSE) |
| [`workbox-cacheable-response`](https://www.npmjs.com/package/workbox-cacheable-response/v/7.4.1) | 7.4.1 | PWA runtime family | MIT | [`LICENSE`](LICENSES/npm/workbox-cacheable-response@7.4.1/LICENSE) |
| [`workbox-core`](https://www.npmjs.com/package/workbox-core/v/7.4.1) | 7.4.1 | PWA runtime family | MIT | [`LICENSE`](LICENSES/npm/workbox-core@7.4.1/LICENSE) |
| [`workbox-expiration`](https://www.npmjs.com/package/workbox-expiration/v/7.4.1) | 7.4.1 | PWA runtime family | MIT | [`LICENSE`](LICENSES/npm/workbox-expiration@7.4.1/LICENSE) |
| [`workbox-precaching`](https://www.npmjs.com/package/workbox-precaching/v/7.4.1) | 7.4.1 | PWA runtime family | MIT | [`LICENSE`](LICENSES/npm/workbox-precaching@7.4.1/LICENSE) |
| [`workbox-routing`](https://www.npmjs.com/package/workbox-routing/v/7.4.1) | 7.4.1 | PWA runtime family | MIT | [`LICENSE`](LICENSES/npm/workbox-routing@7.4.1/LICENSE) |
| [`workbox-strategies`](https://www.npmjs.com/package/workbox-strategies/v/7.4.1) | 7.4.1 | PWA runtime family | MIT | [`LICENSE`](LICENSES/npm/workbox-strategies@7.4.1/LICENSE) |
| [`workbox-sw`](https://www.npmjs.com/package/workbox-sw/v/7.4.1) | 7.4.1 | PWA runtime family | MIT | [`LICENSE`](LICENSES/npm/workbox-sw@7.4.1/LICENSE) |
| [`workbox-window`](https://www.npmjs.com/package/workbox-window/v/7.4.1) | 7.4.1 | PWA runtime family | MIT | [`LICENSE`](LICENSES/npm/workbox-window@7.4.1/LICENSE) |
| [`zod`](https://www.npmjs.com/package/zod/v/3.25.76) | 3.25.76 | client | MIT | [`LICENSE`](LICENSES/npm/zod@3.25.76/LICENSE) |
| [`zod`](https://www.npmjs.com/package/zod/v/4.6.7) | 4.6.7 | client, guest | MIT | [`LICENSE`](LICENSES/npm/zod@4.6.7/LICENSE) |
| [`zustand`](https://www.npmjs.com/package/zustand/v/5.0.16) | 5.0.16 | client | MIT | [`LICENSE`](LICENSES/npm/zustand@5.0.16/LICENSE) |

## Direct npm dependencies

Versions are resolved from the installed lockfile checkout, not the range in the manifest. An npm link identifies the package and version whose metadata was reviewed. See the [Windows production npm inventory](LICENSES/npm-production-inventory.md) for the wider installed runtime graph.

| Component and source | Version | Workspace scope | License | Publisher or copyright |
| --- | --- | --- | --- | --- |
| [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk/v/0.3.306) | 0.3.306 | server runtime | Publisher terms (all rights reserved) | © Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements outlined here: https://code.claude.com/docs/en/legal-and-compliance. |
| [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk/v/0.137.0) | 0.137.0 | server runtime | MIT | Copyright 2023 Anthropic, PBC. |
| [`@dnd-kit/core`](https://www.npmjs.com/package/@dnd-kit/core/v/6.3.1) | 6.3.1 | client runtime | MIT | Copyright (c) 2021, Claudéric Demers |
| [`@earendil-works/pi-ai`](https://www.npmjs.com/package/@earendil-works/pi-ai/v/1.3.0) | 1.3.0 | server runtime | MIT | Mario Zechner |
| [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent/v/1.4.0) | 1.4.0 | server runtime | MIT | Mario Zechner |
| [`@emnapi/runtime`](https://www.npmjs.com/package/@emnapi/runtime/v/1.11.3) | 1.11.3 | server runtime | MIT | Copyright (c) 2021-present Toyobayashi |
| [`@eslint/js`](https://www.npmjs.com/package/@eslint/js/v/10.0.1) | 10.0.1 | client dev | MIT | See source package |
| [`@fastify/cors`](https://www.npmjs.com/package/@fastify/cors/v/11.3.1) | 11.3.1 | server runtime | MIT | Copyright (c) 2018-present The Fastify team &lt;https://github.com/fastify/fastify#team&gt; |
| [`@fastify/multipart`](https://www.npmjs.com/package/@fastify/multipart/v/10.1.4) | 10.1.4 | server runtime | MIT | Copyright (c) 2017-present The Fastify team &lt;https://github.com/fastify/fastify#team&gt; |
| [`@fastify/static`](https://www.npmjs.com/package/@fastify/static/v/10.1.6) | 10.1.6 | server runtime | MIT | Copyright (c) 2017-present The Fastify team &lt;https://github.com/fastify/fastify#team&gt; |
| [`@fontsource/share-tech-mono`](https://www.npmjs.com/package/@fontsource/share-tech-mono/v/5.3.0) | 5.3.0 | client runtime | OFL-1.1 | Copyright (c) 2012, Carrois Type Design, Ralph du Carrois (www.carrois.com, with Reserved Font Name 'Share' |
| [`@huggingface/transformers`](https://www.npmjs.com/package/@huggingface/transformers/v/4.3.1) | 4.3.1 | server runtime | Apache-2.0 | Hugging Face |
| [`@img/sharp-wasm32`](https://www.npmjs.com/package/@img/sharp-wasm32/v/0.35.5) | 0.35.5 | server runtime | Apache-2.0 AND LGPL-3.0-or-later AND MIT | Lovell Fuller |
| [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk/v/1.32.2) | 1.32.2 | server runtime | MIT | Copyright (c) 2024 Anthropic, PBC |
| [`@pixiv/three-vrm`](https://www.npmjs.com/package/@pixiv/three-vrm/v/3.5.5) | 3.5.5 | client runtime | MIT | Copyright (c) 2019-2026 pixiv Inc. |
| [`@pixiv/three-vrm-animation`](https://www.npmjs.com/package/@pixiv/three-vrm-animation/v/3.5.5) | 3.5.5 | client runtime | MIT | Copyright (c) 2019-2026 pixiv Inc. |
| [`@playwright/test`](https://www.npmjs.com/package/@playwright/test/v/1.63.0) | 1.63.0 | root dev | Apache-2.0 | Copyright (c) Microsoft Corporation |
| [`@rollup/wasm-node`](https://www.npmjs.com/package/@rollup/wasm-node/v/4.64.12) | 4.64.12 | client dev | MIT | Rich Harris |
| [`@tailwindcss/vite`](https://www.npmjs.com/package/@tailwindcss/vite/v/4.3.3) | 4.3.3 | client dev | MIT | Copyright (c) Tailwind Labs, Inc. |
| [`@takahirox/three-mmd`](https://www.npmjs.com/package/@takahirox/three-mmd/v/0.1.2) | 0.1.2 | client runtime | MIT | Copyright © 2010-2024 three.js authors |
| [`@tanstack/react-query`](https://www.npmjs.com/package/@tanstack/react-query/v/5.105.1) | 5.105.1 | client runtime | MIT | Copyright (c) 2021-present Tanner Linsley |
| [`@types/node`](https://www.npmjs.com/package/@types/node/v/24.19.2) | 24.19.2 | root dev, server dev | MIT | Copyright (c) Microsoft Corporation. |
| [`@types/pdf-parse`](https://www.npmjs.com/package/@types/pdf-parse/v/1.1.5) | 1.1.5 | server dev | MIT | Copyright (c) Microsoft Corporation. |
| [`@types/react`](https://www.npmjs.com/package/@types/react/v/19.3.0) | 19.3.0 | client dev | MIT | Copyright (c) Microsoft Corporation. |
| [`@types/react-dom`](https://www.npmjs.com/package/@types/react-dom/v/19.3.0) | 19.3.0 | client dev | MIT | Copyright (c) Microsoft Corporation. |
| [`@types/three`](https://www.npmjs.com/package/@types/three/v/0.186.0) | 0.186.0 | client dev | MIT | Copyright (c) Microsoft Corporation. |
| [`@vitejs/plugin-react`](https://www.npmjs.com/package/@vitejs/plugin-react/v/6.1.2) | 6.1.2 | client dev | MIT | Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors |
| [`adm-zip`](https://www.npmjs.com/package/adm-zip/v/0.6.1) | 0.6.1 | root dev, server runtime | MIT | Copyright (c) 2012 Another-D-Mention Software and other contributors |
| [`ajv`](https://www.npmjs.com/package/ajv/v/8.20.0) | 8.20.0 | server runtime | MIT | Copyright (c) 2015-2021 Evgeny Poberezkin |
| [`ajv-formats`](https://www.npmjs.com/package/ajv-formats/v/3.0.1) | 3.0.1 | server runtime | MIT | Copyright (c) 2020 Evgeny Poberezkin |
| [`buttplug`](https://www.npmjs.com/package/buttplug/v/5.0.2) | 5.0.2 | server runtime | BSD-3-Clause | Copyright (c) 2017-2018, Nonpolynomial Labs LLC |
| [`clsx`](https://www.npmjs.com/package/clsx/v/2.1.1) | 2.1.1 | client runtime | MIT | Copyright (c) Luke Edwards &lt;&gt; (lukeed.com) |
| [`dompurify`](https://www.npmjs.com/package/dompurify/v/3.4.17) | 3.4.17 | client runtime | (MPL-2.0 OR Apache-2.0) | Dr.-Ing. Mario Heiderich, Cure53 |
| [`dotenv`](https://www.npmjs.com/package/dotenv/v/18.0.9) | 18.0.9 | server runtime | BSD-2-Clause | Copyright (c) 2015, Scott Motte |
| [`esbuild`](https://www.npmjs.com/package/esbuild/v/0.28.2) | 0.28.2 | root dev | MIT | Copyright (c) 2020 Evan Wallace |
| [`eslint`](https://www.npmjs.com/package/eslint/v/10.13.0) | 10.13.0 | client dev | MIT | Nicholas C. Zakas |
| [`eslint-plugin-react-hooks`](https://www.npmjs.com/package/eslint-plugin-react-hooks/v/7.1.1) | 7.1.1 | client dev | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [`fastify`](https://www.npmjs.com/package/fastify/v/5.12.7) | 5.12.7 | server runtime | MIT | Copyright (c) 2016-present The Fastify team &lt;https://github.com/fastify/fastify#team&gt; |
| [`framer-motion`](https://www.npmjs.com/package/framer-motion/v/13.5.1) | 13.5.1 | client runtime | MIT | Copyright (c) 2018 Framer B.V. |
| [`framer-motion`](https://www.npmjs.com/package/framer-motion/v/14.5.0) | 14.5.0 | client runtime | MIT | Copyright (c) 2018 Framer B.V. |
| [`i18next`](https://www.npmjs.com/package/i18next/v/26.5.11) | 26.5.11 | client runtime | MIT | Copyright (c) 2011-present i18next |
| [`jsonrepair`](https://www.npmjs.com/package/jsonrepair/v/3.15.0) | 3.15.0 | server runtime | ISC | Copyright (c) 2020-2026 by Jos de Jong |
| [`lucide-react`](https://www.npmjs.com/package/lucide-react/v/1.66.0) | 1.66.0 | client runtime | ISC | Copyright (c) 2026 Lucide Icons and Contributors |
| [`mesh-avatar`](https://www.npmjs.com/package/mesh-avatar/v/0.2.1) | 0.2.1 | client runtime | MIT | Copyright (c) 2026 Yuki Shindo |
| [`mmd-parser`](https://www.npmjs.com/package/mmd-parser/v/1.1.4) | 1.1.4 | client runtime, server runtime | MIT | Copyright (c) 2016 Takahiro |
| [`nanoid`](https://www.npmjs.com/package/nanoid/v/6.0.2) | 6.0.2 | server runtime | MIT | Copyright 2017 Andrey Sitnik &lt;&gt; |
| [`onnxruntime-node`](https://www.npmjs.com/package/onnxruntime-node/v/1.30.0) | 1.30.0 | server optional | MIT | fs-eire |
| [`onnxruntime-web`](https://www.npmjs.com/package/onnxruntime-web/v/1.31.0-dev.20260914-8d85527a0) | 1.31.0-dev.20260914-8d85527a0 | server optional | MIT | fs-eire |
| [`pdf-parse`](https://www.npmjs.com/package/pdf-parse/v/2.4.5) | 2.4.5 | server runtime | Apache-2.0 | Mehmet Kozan |
| [`pino`](https://www.npmjs.com/package/pino/v/10.4.0) | 10.4.0 | server runtime | MIT | Copyright (c) 2016-present Matteo Collina, David Mark Clements and the Pino contributors listed at &lt;https://github.com/pinojs/pino#the-team&gt; and in the README  |
| [`pino-pretty`](https://www.npmjs.com/package/pino-pretty/v/13.2.0) | 13.2.0 | server runtime | MIT | Copyright (c) 2019 the Pino team listed at https://github.com/pinojs/pino#the-team |
| [`postcss`](https://www.npmjs.com/package/postcss/v/8.5.32) | 8.5.32 | client runtime | MIT | Copyright 2013 Andrey Sitnik &lt;&gt; |
| [`prettier`](https://www.npmjs.com/package/prettier/v/3.9.10) | 3.9.10 | root dev | MIT | Copyright © James Long and contributors |
| [`quickjs-emscripten`](https://www.npmjs.com/package/quickjs-emscripten/v/0.32.0) | 0.32.0 | server runtime | MIT | Jake Teton-Landis |
| [`react`](https://www.npmjs.com/package/react/v/19.3.1) | 19.3.1 | client runtime | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [`react-dom`](https://www.npmjs.com/package/react-dom/v/19.3.1) | 19.3.1 | client runtime | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [`react-i18next`](https://www.npmjs.com/package/react-i18next/v/17.1.0) | 17.1.0 | client runtime | MIT | Copyright (c) 2015-present i18next |
| [`sharp`](https://www.npmjs.com/package/sharp/v/0.35.5) | 0.35.5 | server optional | Apache-2.0 | Lovell Fuller |
| [`sonner`](https://www.npmjs.com/package/sonner/v/2.0.8) | 2.0.8 | client runtime | MIT | Copyright (c) 2023 Emil Kowalski |
| [`tailwind-merge`](https://www.npmjs.com/package/tailwind-merge/v/3.7.0) | 3.7.0 | client runtime | MIT | Copyright (c) 2021 Dany Castillo |
| [`tailwindcss`](https://www.npmjs.com/package/tailwindcss/v/4.3.3) | 4.3.3 | client dev | MIT | Copyright (c) Tailwind Labs, Inc. |
| [`three`](https://www.npmjs.com/package/three/v/0.186.1) | 0.186.1 | client runtime | MIT | Copyright © 2010-2026 three.js authors |
| [`tsx`](https://www.npmjs.com/package/tsx/v/4.23.15) | 4.23.15 | server dev | MIT | Copyright (c) Hiroki Osame &lt;&gt; |
| [`typescript`](https://www.npmjs.com/package/typescript/v/6.0.3) | 6.0.3 | client dev, root dev, server dev, shared dev | Apache-2.0 | Microsoft Corp. |
| [`typescript-eslint`](https://www.npmjs.com/package/typescript-eslint/v/8.72.1) | 8.72.1 | client dev | MIT | Copyright (c) 2019 typescript-eslint and other contributors |
| [`undici`](https://www.npmjs.com/package/undici/v/8.12.3) | 8.12.3 | server runtime | MIT | Copyright (c) Matteo Collina and Undici contributors |
| [`vite`](https://www.npmjs.com/package/vite/v/8.3.5) | 8.3.5 | client dev | MIT | Copyright (c) 2019-present, VoidZero Inc. and Vite contributors |
| [`vite-plugin-pwa`](https://www.npmjs.com/package/vite-plugin-pwa/v/2.0.0) | 2.0.0 | client dev | MIT | Copyright (c) 2020-PRESENT Anthony Fu &lt;https://github.com/antfu&gt; |
| [`workbox-window`](https://www.npmjs.com/package/workbox-window/v/7.4.1) | 7.4.1 | client runtime | MIT | Copyright 2018 Google LLC |
| [`zod`](https://www.npmjs.com/package/zod/v/3.25.76) | 3.25.76 | client runtime, server runtime | MIT | Copyright (c) 2025 Colin McDonnell |
| [`zod`](https://www.npmjs.com/package/zod/v/4.6.7) | 4.6.7 | client runtime, server runtime, shared runtime | MIT | Copyright (c) 2025 Colin McDonnell |
| [`zustand`](https://www.npmjs.com/package/zustand/v/5.0.16) | 5.0.16 | client runtime | MIT | Copyright (c) 2019 Paul Henschel |
