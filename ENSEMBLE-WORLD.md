# M2 character world

M2 is opt-in per Individual Conversation with at least two characters. It uses the M1 character model selection and server exchange controls. In a configured world, the scheduler asks one character to propose a single action; the server validates and applies it. A Conversation without a world retains its existing chat and exchange behavior.

## Start and enter the demo

1. In the repository run `pnpm install`, then `pnpm dev`. Open the Vite address printed in the terminal (normally [localhost:5173](http://localhost:5173)); the API normally listens on [127.0.0.1:7860](http://127.0.0.1:7860).
2. Keep an LM Studio connection saved in Marinara. Run `node scripts/create-ensemble-world-demo.mjs` to add **M2 演示 · 翠庭的旧钥匙** to Conversations. The script uses the saved local connection and prefers the `ensemble-coder` and `ensemble-deepseek` model IDs. If your names differ, run `node scripts/create-ensemble-world-demo.mjs http://127.0.0.1:7860 <connection-id> <model-a> <model-b>`. The script creates one conversation, three AI characters and a player persona. Running it again reuses the existing demo.
3. Open the demo, then **Chat Settings → Autonomous Messaging → Character world**. The three scenes are 庭院, 书房 and 客厅. Use **Your scene** to move and **Server character exchanges → Start** to start autonomous turns. Characters can act before you send a message. The provided goals encourage 林澈 to visit the study and 许岚 to follow her; the models choose what to do.
4. To speak only to the characters with you, use **Characters currently present** in the composer. **Public** is a broadcast; selecting a named recipient is private even across scenes. **Events you witnessed** lists events the player could observe at the time. Visiting a room later does not reveal its previous private conversations.
5. Close and reopen the browser to see the stored timeline. **Pause** cancels a pending turn and prevents new inference until resumed. **Stop** ends the run. After the budget pauses the run, stop and start again with a new budget; the world stays in place.

To configure your own world, choose Individual mode in a Conversation with at least two characters, open **Character world**, and add one or more named scenes. The first scene is the initial location. You can edit names, add scenes, and set a goal for each actor while stopped or paused. An occupied scene cannot be removed. Normal group messages, private messages and model assignments are still available.

## Contract for M3

The shared client types are defined in [ensemble-world.schema.ts](packages/shared/src/schemas/ensemble-world.schema.ts). These are local app endpoints under the existing Conversation route:

| Endpoint | Request | Response |
| --- | --- | --- |
| `GET /api/conversation/ensemble-world/:chatId` | Optional `?before=<minute>` | `{ world: EnsembleWorldView \| null }` |
| `POST /api/conversation/ensemble-world/:chatId` | `{ action: "configure", settings: { scenes: [{id, name}], goals: [{characterId, goal}] } }` or `{ action: "move", sceneId }` | Updated player view; `409` if the requested change is unavailable |
| `GET /api/conversation/group-autonomy/:chatId` | None | `{ state }`, including status, pause reason, limits and usage |
| `POST /api/conversation/group-autonomy/:chatId` | `{ action: "start", limits: { intervalSeconds, maxCalls, maxTokens } }`, or `pause`, `resume`, `stop` as the action | Updated run state |

World views include the world ID, simulation minute, scene definitions, player-authored goals, current player scene, visible actor activity, recent observable interactions and a page of up to 30 witnessed events. Use `nextBefore` for the next page. A character outside the player's sight has `present: false` and no exposed location or activity. A scene can be visible while its earlier dialogue remains private. The relationship list reflects witnessed exchanges; the actual directional judgments are available only to their owning characters. A visible speech event may carry the existing chat message ID.

The server keeps three separate views:

- **World truth:** scene positions and the journal of actions and their results. Dialogue in the journal records what was said; it does not turn a statement into a fact.
- **Character knowledge:** the actor's card and goal, their own scene and company, evidence they witnessed or were sent, and their own memories and appraisals. The request never includes the whole world or another actor's memory. Reflections and relationship appraisals must cite known evidence; a reflection may be tentative, believed, disputed or corrected.
- **Player view:** visible positions and player-witnessed events, together with the configuration the player authored. There is no public endpoint to request an arbitrary actor's dossier.

## Persistence, permissions and limits

World state and events use optional chat-keyed tables in the existing file store. Existing chats load without these records. Events and state commit together; an action proposed against a stale world revision cannot replay. Player-visible dialogue uses the existing transcript and message audience; dialogue wholly outside the player's perspective stays in its event. A retelling creates a new event with its own recipient and words. The source link stays internal. Memory and relationship evidence linked to a transcript message is checked again on recall, including its current ACL and content fingerprint.

The M1 scheduler retains interval and call limits, pre-reserves tokens, and allows one managed group turn at a time. M2 adds duplicate action checks and a cooldown after waiting or consecutive unproductive turns. Relevant new events can wake an actor. A model request failure pauses the run. No additional summarizer or embedding calls are required to run a world.

The first version uses bounded lexical recall and event-linked notes, so long-running worlds can age out older memories. Private world events stay within the source Conversation and are not included in ordinary transcript exports. The engine controls who receives each request and retelling. As part of the roleplay, an authorized recipient can intentionally retell or misrepresent what they learned.

Run `node scripts/run-regressions.mjs --filter scripts/regressions/ensemble-world.regression.ts` after building shared types (`pnpm build:shared`). This proof uses an isolated file store and two Mock model IDs, captures the actual provider requests, and checks scene movement, retelling, memory recall and revocation, asymmetric relationships, restart, and pause.
