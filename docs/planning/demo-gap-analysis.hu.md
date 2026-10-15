# Fejlesztési terv – AI tudásbázis chatbot demó (gap analysis)

**Alapdokumentum:** „AI tudásbázis chatbot – Dokumentáció és fejlesztési terv” (2026-10-15)
**Kiinduló állapot:** greenfield – a dokumentáció létezik, kód még nincs. A gap a terv és a nulla kód közötti különbség.
**Hatókör:** az interjúra szánt demó, 1 munkanap (12 óra), egy full-stack fejlesztő.
**Repó:** publikus GitHub repó `kb-assistant` néven, deploy Vercelre.

## Rögzített döntések

| Terület | Döntés a demóban | Eltérés a dokumentációtól |
| --- | --- | --- |
| Futtatás | Vercel + Supabase (EU régió: Frankfurt, `eu-central-1`) | A dokumentáció Docker Compose-t tervez |
| Fejlesztői környezet | Közvetlenül a felhős Supabase projekttel | – |
| Generáló modell | `gpt-5.5`, `reasoningEffort: 'low'`, temperature nélkül | A dokumentáció „Temperature 0”-t ír elő; a GPT-5 családnál ez nem alkalmazható megbízhatóan |
| Segédmodell (rerank, query rewrite) | `gpt-5.4-mini`, `reasoningEffort: 'low'` | – |
| Embedding | `text-embedding-3-small`, 1536 dimenzió | – |
| Adatréteg | Drizzle ORM + `postgres` (postgres.js) driver, a keresés nyers SQL-ben | – |
| LLM integráció | Vercel AI SDK: `streamText` / `generateText` + `Output.object` | Az AI SDK 6 óta a `streamObject` / `generateObject` deprecated |
| Streaming és validálás | A részleges válasz streamelődik, a végén szerveroldali validálás; hiba esetén a UI lecseréli a választ | – |
| Beszélgetés-előzmény | Kliens oldalon (React state), minden kéréssel elküldve | A dokumentáció `conversations` / `messages` táblát tervez |
| Reranker | LLM-alapú rerank 0–10 skálán, küszöb: 6 (`RERANK_THRESHOLD`) | A dokumentáció cross-encoder rerankert tervez |
| Védelem | Basic Auth a `src/proxy.ts`-ben, jelszó env változóban | A dokumentáció szerint a demóban nincs auth; a Next.js 16-ban a `middleware.ts` neve `proxy.ts` |
| Tesztek | Vitest unit tesztek + eval script 15 kérdéssel, csak automatikus metrikákkal | – |
| Csomagkezelő | npm | – |
| Kimarad a demóból | Szám-ellenőrzés a validátorban, verziókezelés, visszajelzés gomb, admin UI, SSO, Langfuse, LLM-as-judge | A dokumentáció demóterve ezek egy részét tartalmazza |

## Bemenetek

Ezek a fejlesztési nap előtt elkészülnek, a tervben kész bemenetként szerepelnek:

- **`data/docs/*.md`** – 12–15 markdown dokumentum a Bankmonitor nyilvános cikkeiből, saját szavakkal összefoglalva. Front matter mezők: `title`, `products`, `banks`, `source_url`, `updated_at`. Elkészíti: Claude.
- **`data/golden-set.json`** – 15 tesztkérdés, ebből 4 megválaszolhatatlan. Mezők: `id`, `question`, `product`, `bank`, `expected_sources` (dokumentum slugok, azaz fájlnevek `.md` nélkül), `answerable`. A golden set tartalmazza a főpróba (23. feladat) összes kérdését, és a tudásanyag ezekre megadja a választ. Elkészíti: Claude.
- **Fiókok** – OpenAI API kulcs, Vercel és GitHub fiók megvan; a Supabase fiókot a 2. feladat hozza létre.

## 1. Összesítő táblázat

### A) Alapok és infrastruktúra

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Projekt váz létrehozása | `package.json`, `src/app/`, `components.json` | Nincs kód; a dokumentáció csak a repo struktúrát írja le | Minden további feladat erre épül | 🔴 blokkoló | S |
| 2 | Supabase projekt és adatbázis-kapcsolat | Supabase projekt, `src/db/client.ts`, `.env.local` | Nincs adatbázis; a dokumentáció Docker Compose-t tervez | Vercelről csak felhős adatbázis érhető el | 🔴 blokkoló | S |
| 3 | Drizzle séma és migráció | `src/db/schema.ts`, `drizzle.config.ts`, `drizzle/` | A dokumentáció SQL-jéből hiányzik a `banks` oszlop, és a demóban felesleges mezőket tartalmaz | A termék- és bankszűrés, valamint a hybrid search ezen múlik | 🔴 blokkoló | S |

### B) Tudásanyag és ingestion

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | Markdown betöltő és front matter validálás | `src/lib/ingest/load.ts` | Nincs betöltő; a front matter mezőit semmi nem ellenőrzi | Hibás metaadatnál a szűrés csendben rossz találatot ad | 🔴 blokkoló | S |
| 5 | Fejezet-alapú chunking kontextus fejléccel | `src/lib/ingest/chunk.ts` | Nincs chunking | A keresés minősége a chunkok minőségén múlik | 🔴 blokkoló | S |
| 6 | Embedding és mentés, idempotens újrafuttatással | `scripts/ingest.ts`, `src/lib/embeddings.ts` | Nincs embedding és index | Enélkül nincs miben keresni | 🔴 blokkoló | S |

### C) Retrieval

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | Hybrid search termék- és bankszűrővel | `src/lib/retrieval/search.ts` | Nincs keresés | A pontos kifejezéseket (THM, banknevek) csak a full-text keresés találja meg biztosan | 🔴 blokkoló | S |
| 8 | RRF összefésülés | `src/lib/retrieval/rrf.ts` | Nincs összefésülés | A vektoros és a full-text pontszám nem vethető össze közvetlenül | 🟠 komoly | S |
| 9 | LLM rerank és relevancia-küszöb | `src/lib/retrieval/rerank.ts` | Nincs rerank és küszöb | Gyenge találatnál ez akadályozza meg a generálást | 🔴 blokkoló | S |
| 10 | Follow-up query rewrite | `src/lib/retrieval/rewrite.ts` | Nincs | Előzmény nélkül az „És mennyi a futamidő?” kérdés nem kereshető | 🟠 komoly | S |

### D) Generálás és pontosság

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | System prompt és structured output séma | `src/lib/generation/prompt.ts`, `src/lib/generation/schema.ts` | A dokumentáció „Temperature 0”-t ír elő, ez a GPT-5 családnál nem alkalmazható; a `streamObject` deprecated | Ez köti a választ a forrásokhoz | 🔴 blokkoló | S |
| 12 | Idézet-validátor, újrapróba, not_found | `src/lib/generation/validate.ts` | Nincs | Ez a kódból ellenőrzött garancia arra, hogy hibás információ nem megy ki | 🔴 blokkoló | S |
| 13 | Közös pipeline függvény | `src/lib/pipeline.ts` | Nincs | Az API és az eval script ugyanazt a logikát futtatja, így az eval a valós működést méri | 🔴 blokkoló | S |

### E) API

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 14 | Streaming chat végpont | `src/app/api/chat/route.ts` | Nincs | A UI ezen keresztül kap részleges választ és végleges, validált eredményt | 🔴 blokkoló | S |
| 15 | Banklista végpont | `src/app/api/banks/route.ts` | Nincs | A bankszűrő opciói az adatból jönnek, nem kézzel karbantartott listából | 🟡 csiszolás | S |

### F) Felület

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | Chat felület szűrőkkel és előzménnyel | `src/app/page.tsx`, `src/components/FilterBar.tsx`, `src/components/ChatInput.tsx` | Nincs | Ezt látja az interjúztató | 🔴 blokkoló | S |
| 17 | Válasz, hivatkozás-jelölők és forráskártyák | `src/components/AnswerView.tsx`, `src/components/SourceCard.tsx` | Nincs | Az üzleti kérés kifejezetten kéri, hogy látszódjon a forrás | 🔴 blokkoló | S |

### G) Biztonság

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 18 | Basic Auth védelem | `src/proxy.ts` | A nyilvános URL-en bárki a te OpenAI kulcsodat használná | Költség- és visszaélési kockázat | 🟠 komoly | S |

### H) Minőség

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 19 | Vitest unit tesztek | `vitest.config.ts`, `tests/` | Nincs teszt | A validátor egy hibája csendben átengedné a hallucinációt | 🟠 komoly | S |
| 20 | Eval script a golden setre | `scripts/eval.ts` | Nincs mérés | Számokkal mutatod meg a pontosságot az interjún | 🟠 komoly | S |

### I) Deploy és bemutató

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | Publikus GitHub repó és Vercel deploy | GitHub `kb-assistant` repó, Vercel projekt | Nincs deploy | Online, linkkel bemutatható | 🔴 blokkoló | S |
| 22 | README | `README.md` | Nincs | A publikus repó első benyomása az interjúztatónak | 🟡 csiszolás | S |
| 23 | Főpróba a bemutató szcenárióival | Éles Vercel URL | A dokumentáció 6 szcenáriójából a verziókezelési kimarad, a többit élesben még senki nem futtatta | A bemutatón derülne ki, ha valami nem működik | 🟠 komoly | S |

## 2. Részletes kidolgozás

### 1. Projekt váz létrehozása

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Projekt váz létrehozása | `package.json`, `src/app/`, `components.json` | Nincs kód; a dokumentáció csak a repo struktúrát írja le | Minden további feladat erre épül | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs repó és nincs kód. A dokumentáció „Demó építési terv › Repo struktúra” része írja le a célállapotot (`src/app/page.tsx`, `src/lib/…`, `scripts/…`, `data/…`).

**Probléma**
Váz nélkül egyik további feladat sem kezdhető el. Ha a környezeti változókat nem validáljuk induláskor, egy hiányzó kulcs csak futás közben, a bemutatón derül ki, homályos hibaüzenettel.

**Megoldás**
1. Projekt létrehozása:
   ```bash
   npx create-next-app@latest kb-assistant --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
   ```
2. shadcn/ui inicializálás és a szükséges komponensek:
   ```bash
   npx shadcn@latest init
   npx shadcn@latest add button card badge select textarea scroll-area
   ```
3. Függőségek:
   ```bash
   npm install ai @ai-sdk/openai zod drizzle-orm postgres gray-matter
   npm install -D drizzle-kit tsx vitest dotenv
   ```
4. Scriptek a `package.json`-ba:
   ```json
   "ingest": "tsx scripts/ingest.ts",
   "eval": "tsx scripts/eval.ts",
   "test": "vitest run",
   "db:generate": "drizzle-kit generate",
   "db:migrate": "drizzle-kit migrate"
   ```
5. `src/lib/env.ts`: zod sémával validált környezeti változók, egyetlen exportált `env` objektummal:
   - `OPENAI_API_KEY` (kötelező)
   - `DATABASE_URL` (kötelező, a Supabase transaction pooler URL-je, lásd 2. feladat)
   - `GENERATION_MODEL` (alapértelmezés: `gpt-5.5`)
   - `HELPER_MODEL` (alapértelmezés: `gpt-5.4-mini`)
   - `EMBEDDING_MODEL` (alapértelmezés: `text-embedding-3-small`)
   - `RERANK_THRESHOLD` (`z.coerce.number().min(0).max(10)`, alapértelmezés: `6`)
   - `DEMO_USER`, `DEMO_PASSWORD` (kötelező, lásd 18. feladat)

   Hibás vagy hiányzó változónál a `env.ts` a változó nevével együtt dob hibát.
6. `.env.example` a fenti kulcsokkal, értékek nélkül; mellé a `DATABASE_URL_SESSION` (2. feladat) és a `DEMO_URL` kulcs (21. feladat); ez utóbbi kettőt csak a scriptek és a tesztparancsok használják, az `env.ts` nem. A `create-next-app` által generált `.gitignore` `.env*` mintát tartalmaz, ezért alá kerül egy `!.env.example` sor, különben a példafájl sem kerül a repóba.
7. A `scripts/` alatti fájlok elején: `import { config } from 'dotenv'; config({ path: '.env.local' });` – a `tsx` magától nem tölti be a `.env.local`-t.
8. A `data/docs/` mappa és a `data/golden-set.json` bemásolása (lásd „Bemenetek”).
9. `git init`, első commit.

**Elfogadási feltételek**
- `npm run dev` után a `http://localhost:3000` betölt hiba nélkül.
- `npm run build` hibátlanul lefut.
- Hiányzó `OPENAI_API_KEY` esetén az alkalmazás a változó nevét tartalmazó hibával áll le.
- `git status` nem mutatja a `.env.local`-t, a `.env.example` viszont commitolható.
- A `data/docs/` alatt ott van mind a 12–15 dokumentum, és létezik a `data/golden-set.json`.

**Tesztelés**
- `npm run dev` és `npm run build` futtatása.
- Egy változó ideiglenes törlése a `.env.local`-ból, majd újraindítás: a hibaüzenetnek meg kell neveznie a változót.
- `git check-ignore .env.local` kimenete a fájlnév, a `git check-ignore .env.example` kimenete üres.

**Függőségek és kockázatok**
- Függőség: nincs.
- Kockázat: ha a `src/lib/env.ts`-t egy route modul legfelső szintjén importáljuk, a `next build` már build közben kéri a változókat. Vercelen ezért a változókat a deploy előtt be kell állítani (21. feladat).
- Kockázat: a `shadcn init` interaktív kérdéseire az alapértelmezés megfelelő; más stílus választása nem okoz hibát, csak eltérő kinézetet.

### 2. Supabase projekt és adatbázis-kapcsolat

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | Supabase projekt és adatbázis-kapcsolat | Supabase projekt, `src/db/client.ts`, `.env.local` | Nincs adatbázis; a dokumentáció Docker Compose-t tervez | Vercelről csak felhős adatbázis érhető el | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs Supabase fiók és projekt. A dokumentáció „Tech stack javaslat” táblázata a demóhoz Docker Compose-t ír; ez a Vercel + Supabase döntés miatt kimarad.

**Probléma**
Adatbázis nélkül nincs ingestion és keresés. Supabase-en a direkt kapcsolat (5432-es port a `db.<projekt>.supabase.co` hoszton) alapból csak IPv6-on érhető el, a Vercel serverless függvényei pedig sok rövid kapcsolatot nyitnak. Ha nem a megfelelő poolert használjuk, a kapcsolat vagy nem jön létre, vagy a prepared statementek miatt hibázik.

**Megoldás**
1. Supabase fiók létrehozása, új projekt `kb-assistant` néven, régió: Central EU (Frankfurt). Az adatbázis jelszavát jelszókezelőbe kell menteni.
2. A projekt „Connect” paneljéről két kapcsolati URL kell:
   - **Transaction pooler** (6543-as port) → `DATABASE_URL`: ezt használja az alkalmazás és a scriptek.
   - **Session pooler** (5432-es port) → `DATABASE_URL_SESSION`: ezt használja a `drizzle-kit` a migrációkhoz.

   Mindkettő a `.env.local`-ba kerül.
3. `src/db/client.ts`:
   ```ts
   import { drizzle } from 'drizzle-orm/postgres-js';
   import postgres from 'postgres';
   import { env } from '@/lib/env';
   import * as schema from './schema';

   const client = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
   export const db = drizzle(client, { schema });
   ```
   A `prepare: false` kötelező, mert a transaction pooler nem támogatja a prepared statementeket. A `max: 1` serverless környezetben megakadályozza, hogy egy függvénypéldány több kapcsolatot nyisson.
4. Ellenőrző script: `scripts/db-check.ts`, amely lefuttatja a `select to_tsvector('hungarian', 'lakáshitelek igénylése')` lekérdezést, és kiírja az eredményt.

**Elfogadási feltételek**
- A Supabase projekt a Frankfurt régióban fut.
- `npx tsx scripts/db-check.ts` szótövezett lexémákat ír ki (nem hibát és nem üres eredményt), vagyis a `hungarian` full-text konfiguráció elérhető.
- A `.env.local` tartalmazza a `DATABASE_URL`-t (6543-as port) és a `DATABASE_URL_SESSION`-t (5432-es port).

**Tesztelés**
- `npx tsx scripts/db-check.ts` futtatása.
- A Supabase SQL Editorban: `select cfgname from pg_ts_config where cfgname = 'hungarian';` – egy sort kell visszaadnia.

**Függőségek és kockázatok**
- Függőség: 1. feladat (`src/lib/env.ts`).
- Kockázat: az ingyenes Supabase projekt hosszabb inaktivitás után szünetel. A bemutató előtti főpróba (23. feladat) ezt is ellenőrzi.
- Kockázat: ha a jelszó speciális karaktert tartalmaz, az URL-ben URL-kódolni kell, különben a kapcsolat „invalid URL” hibával elbukik.

### 3. Drizzle séma és migráció

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | Drizzle séma és migráció | `src/db/schema.ts`, `drizzle.config.ts`, `drizzle/` | A dokumentáció SQL-jéből hiányzik a `banks` oszlop, és a demóban felesleges mezőket tartalmaz | A termék- és bankszűrés, valamint a hybrid search ezen múlik | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs séma. A dokumentáció „Adatmodell és API” szakasza nyers SQL-t ad a `documents` és a `chunks` táblára. Eltérések a demó döntéseihez képest:
- A `chunks` táblából hiányzik a `banks text[]` oszlop, pedig a „Forráshivatkozás és termékszűrés” szakasz bankszűrőt ír elő.
- A `documents` tábla `version`, `valid_from`, `valid_to`, `owner` és `status` oszlopa a verziókezeléshez kell, ami a demóból kimarad.
- A `chunks.page` oszlop markdown forrásnál értelmetlen.
- Nincs `slug` és `content_hash`, pedig az idempotens ingestionhöz (6. feladat) kellenek.

**Probléma**
Bankszűrő oszlop nélkül a bankszűrés nem valósítható meg pre-filterként. Hash nélkül minden ingest újra-embeddel mindent, ami lassú és felesleges költség.

**Megoldás**
1. `src/db/schema.ts`:
   - `tsvector` custom típus: `customType<{ data: string }>({ dataType: () => 'tsvector' })`.
   - `documents` tábla: `id` (uuid, `defaultRandom()`, PK), `slug` (text, unique, not null – a fájlnév `.md` nélkül), `title` (text, not null), `products` (text[], not null), `banks` (text[], not null, alapértelmezés `{}`), `sourceUrl` (text, not null), `updatedAt` (date, not null – a front matter `updated_at` mezője), `contentHash` (text, not null), `createdAt` (timestamptz, `defaultNow()`).
   - `chunks` tábla: `id` (uuid, PK), `documentId` (uuid, FK → `documents.id`, `onDelete: 'cascade'`), `ordinal` (integer, not null – a chunk sorszáma a dokumentumon belül), `sectionPath` (text, not null), `contextHeader` (text, not null), `content` (text, not null), `products` (text[], not null), `banks` (text[], not null), `embedding` (`vector('embedding', { dimensions: 1536 })`, not null), `tsv` (tsvector, `generatedAlwaysAs(sql\`to_tsvector('hungarian', context_header || ' ' || content)\`)`).
   - Indexek: `index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops'))`, GIN index a `tsv`, a `products` és a `banks` oszlopra, B-tree index a `documentId`-ra.
2. `drizzle.config.ts`: `dialect: 'postgresql'`, `schema: './src/db/schema.ts'`, `out: './drizzle'`, `dbCredentials: { url: process.env.DATABASE_URL_SESSION! }`; a fájl elején a `.env.local` betöltése dotenv-vel.
3. Első, kézi migráció a pgvector bővítményhez:
   ```bash
   npx drizzle-kit generate --custom --name enable_vector
   ```
   A generált SQL fájl tartalma: `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;`
4. A séma migrációja és futtatás:
   ```bash
   npm run db:generate -- --name init
   npm run db:migrate
   ```

**Elfogadási feltételek**
- A Supabase Table Editorban látszik a `documents` és a `chunks` tábla a fenti oszlopokkal.
- A `chunks.tsv` generált oszlop, a `chunks_embedding_idx` HNSW index létezik.
- A `drizzle/` mappában két migráció van: először az `enable_vector`, utána az `init`.
- Egy tesztsor beszúrásakor a `tsv` automatikusan kitöltődik.

**Tesztelés**
- SQL Editorban egy tesztdokumentum és egy chunk beszúrása, az embedding helyén `array_fill(0, array[1536])::vector`. Utána `select tsv from chunks` nem üres, végül a tesztsorok törlése.
- `select indexname from pg_indexes where tablename = 'chunks';` – megjelenik a HNSW és a három GIN index.

**Függőségek és kockázatok**
- Függőség: 2. feladat.
- Kockázat: ha a `drizzle-kit` a generált `tsv` oszlopot nem a várt SQL-lel generálja, az oszlop és az index egy újabb `--custom` migrációban, kézi SQL-lel hozható létre.
- Kockázat: a `vector` típus az `extensions` sémában van. A Supabase alapértelmezett `search_path`-ja tartalmazza, ezért a `vector(1536)` típus és a `<=>` operátor séma-előtag nélkül is feloldódik.

### 4. Markdown betöltő és front matter validálás

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | Markdown betöltő és front matter validálás | `src/lib/ingest/load.ts` | Nincs betöltő; a front matter mezőit semmi nem ellenőrzi | Hibás metaadatnál a szűrés csendben rossz találatot ad | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs betöltő. A dokumentáció „Demó építési terv › Scope” része rögzíti a front matter mezőit: cím, termék(ek), bank(ok), forrás-URL, frissítés dátuma.

**Probléma**
Ha egy dokumentum termékkódja elírt (pl. `szemelyi-kolcson` a `szemelyi_kolcson` helyett), a termékszűrő egyszerűen nem találja meg. Hiba nem keletkezik, csak a válasz lesz „nincs forrás”. Ugyanez a banknevekkel: az „OTP” és az „OTP Bank” két külön bank lesz a szűrőben.

**Megoldás**
1. `src/lib/ingest/load.ts`, exportált függvény: `loadDocuments(dir = 'data/docs'): Promise<LoadedDocument[]>`.
2. Beolvasás `fs/promises`-szal (`readdir`, `readFile`), csak a `.md` kiterjesztésű fájlok; parse a `gray-matter`-rel.
3. Zod séma a front matterre:
   - `title`: `z.string().min(1)`
   - `products`: `z.array(z.enum(['lakashitel', 'szemelyi_kolcson', 'bankszamla', 'altalanos'])).min(1)`
   - `banks`: `z.array(z.string().min(1))` – általános dokumentumnál üres tömb
   - `source_url`: `z.string().url().startsWith('https://bankmonitor.hu/')`
   - `updated_at`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`
4. Származtatott mezők: `slug` = a fájlnév `.md` nélkül; `contentHash` = a teljes nyers fájl SHA-256 hash-e (`node:crypto`); `body` = a front matter utáni markdown.
5. Konzisztencia-ellenőrzések minden fájl betöltése után:
   - minden `slug` egyedi;
   - a `body` nem üres;
   - a banknevek között nincs olyan pár, amely csak kis- és nagybetűben vagy szóközökben tér el (pl. `OTP Bank` és `OTP bank`).
6. Hibakezelés: a függvény először minden fájlt ellenőriz, és ha bármelyik hibás, egyetlen összesített hibát dob fájlnévvel és mezőnévvel. Részleges betöltés nincs.

**Elfogadási feltételek**
- A `data/docs/` minden dokumentuma hiba nélkül betöltődik.
- Egy `products: [hitel]` értékű tesztfájl esetén a hibaüzenet tartalmazza a fájl nevét és a `products` mezőt.
- Két, csak kisbetű-nagybetűben eltérő banknév esetén a betöltés hibával leáll, mindkét változatot megnevezve.
- Hibás fájl esetén az adatbázisba semmi nem kerül (ezt a 6. feladat ingest scriptje garantálja azzal, hogy csak sikeres betöltés után ír).

**Tesztelés**
- Egy ideiglenes mappába egy helyes és egy hibás front matterű fájl másolása, a `tmp/load-check/` mappába (a `.gitignore`-ba felvéve), majd `loadDocuments('tmp/load-check')` hívása egy rövid `tsx` scriptből: a hibaüzenetnek a hibás fájlt kell megneveznie.
- Ugyanez két eltérő írásmódú banknévvel.

**Függőségek és kockázatok**
- Függőség: 1. feladat; bemenet: `data/docs/*.md`.
- Kockázat: a `gray-matter` a `YYYY-MM-DD` formátumú, idézőjel nélküli dátumot `Date` objektummá alakítja. A séma ezért az `updated_at`-et `z.union([z.string(), z.date()])` típusként fogadja, és `toISOString().slice(0, 10)`-zel egységes stringgé alakítja, mielőtt a regex-ellenőrzés lefut.

### 5. Fejezet-alapú chunking kontextus fejléccel

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | Fejezet-alapú chunking kontextus fejléccel | `src/lib/ingest/chunk.ts` | Nincs chunking | A keresés minősége a chunkok minőségén múlik | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs chunking. A dokumentáció „Architektúra › Ingestion pipeline” része írja elő: struktúra-alapú darabolás fejezetek mentén, kb. 400–800 token, kis átfedéssel, a táblázatok egyben maradnak, és minden chunk elé kontextus fejléc kerül.

**Probléma**
Fix méretű darabolásnál egy „Futamidő” bekezdés elválhat a címsorától, és nem derül ki, melyik termékhez vagy bankhoz tartozik. Egy kettévágott kondíciós táblázat sorai elveszítik a fejlécüket, így a modell rossz számot rendelhet rossz oszlophoz.

**Megoldás**
1. `src/lib/ingest/chunk.ts`, exportált függvény: `chunkDocument(doc: LoadedDocument): ChunkDraft[]`, ahol `ChunkDraft = { ordinal, sectionPath, contextHeader, content }`.
2. Szakaszolás a `##` és `###` címsorok mentén. A `sectionPath` a címsorok útvonala, pl. `Feltételek > Futamidő`. Az első címsor előtti szöveg szakaszneve: `Bevezető`.
3. Méretkorlát karakterben, tokenizáló könyvtár nélkül: legfeljebb 2400 karakter chunkonként. Ez magyar szövegnél kb. 800 token, ami illeszkedik a dokumentáció 400–800 tokenes sávjához.
4. A 2400 karakternél hosszabb szakasz bekezdéshatárokon (üres sor) darabolódik. Átfedés: az előző darab utolsó bekezdése, ha legfeljebb 400 karakter.
5. A táblázat (egymást követő, `|`-vel kezdődő sorok) egyetlen blokk, soha nem darabolódik. Ha egyetlen blokk önmagában hosszabb 2400 karakternél, egyben marad.
6. A 150 karakternél rövidebb szakasz (pl. csak egy címsor és egy mondat) összeolvad a következő szakasszal.
7. Kontextus fejléc formátuma:
   ```text
   <title> | Termék: <products vesszővel> | Bank: <banks vesszővel vagy "általános"> | <sectionPath>
   ```
   A fejléc külön mezőben tárolódik (`contextHeader`), a `content` csak a szakasz szövege. Így az idézet-validátor (12. feladat) a tényleges szövegben keres, az embedding és a full-text index viszont a fejlécet is látja.

**Elfogadási feltételek**
- Egyetlen chunk `content`-je sem hosszabb 2400 karakternél, kivéve ha egyetlen oszthatatlan blokkból áll.
- Táblázat soha nem kerül két chunkba.
- Minden chunknak van nem üres `sectionPath`-ja és `contextHeader`-je.
- Az `ordinal` dokumentumonként 0-tól folytonos.

**Tesztelés**
- Unit tesztek a 19. feladatban (`tests/chunk.test.ts`): címsor szerinti szakaszolás, hosszú szakasz darabolása átfedéssel, ép táblázat, rövid szakasz összevonása.
- Kézi ellenőrzés: az ingest script (6. feladat) kiírja dokumentumonként a chunkok számát és a leghosszabb chunk hosszát.

**Függőségek és kockázatok**
- Függőség: 4. feladat (`LoadedDocument` típus).
- Kockázat: ha a Bankmonitor alapú dokumentumokban kevés a `##` címsor, a chunkok nagyok és kevesen lesznek. Ezt a bemenetek elkészítésekor a dokumentumok szerkezete kezeli: minden dokumentum témánként `##` címsorokkal tagolt.

### 6. Embedding és mentés, idempotens újrafuttatással

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 6 | Embedding és mentés, idempotens újrafuttatással | `scripts/ingest.ts`, `src/lib/embeddings.ts` | Nincs embedding és index | Enélkül nincs miben keresni | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs ingest script és embedding modul. A dokumentáció repo struktúrája tartalmazza a `scripts/ingest.ts`-t; a demóban szinkron script fut a háttér-queue (BullMQ) helyett.

**Probléma**
Embedding nélkül a vektoros keresés nem működik. Ha a script minden futáskor mindent újra-embeddel, a fejlesztés közbeni sok újrafuttatás lassú és felesleges költség. Ha nem törli a fájlrendszerből eltávolított dokumentumokat, a keresés olyan forrást is visszaadhat, ami már nincs a tudásanyagban.

**Megoldás**
1. `src/lib/embeddings.ts`:
   ```ts
   import { embed, embedMany } from 'ai';
   import { openai } from '@ai-sdk/openai';
   import { env } from '@/lib/env';

   const model = openai.embedding(env.EMBEDDING_MODEL);

   export async function embedTexts(values: string[]) {
     const { embeddings } = await embedMany({ model, values });
     return embeddings;
   }

   export async function embedQuery(value: string) {
     const { embedding } = await embed({ model, value });
     return embedding;
   }
   ```
   Az `embedMany` a nagy kérést automatikusan kisebb darabokra bontja.
2. Az embedding bemenete chunkonként: `contextHeader + '\n\n' + content`.
3. `scripts/ingest.ts` folyamata:
   1. `.env.local` betöltése, `loadDocuments()` hívása. Hiba esetén kilépés `process.exit(1)`-gyel, az adatbázis érintése nélkül.
   2. A meglévő dokumentumok lekérdezése (`slug`, `contentHash`).
   3. Minden fájlra: ha a `slug` létezik és a `contentHash` egyezik → kihagyás. Egyébként egy tranzakcióban: a régi dokumentum törlése (a chunkok kaszkádolva törlődnek), az új dokumentum beszúrása, chunking (5. feladat), embedding, a chunkok beszúrása a dokumentum `products` és `banks` értékével.
   4. Azoknak a dokumentumoknak a törlése, amelyek `slug`-ja már nincs a fájlok között.
   5. Összesítő kiírás: új, frissített, változatlan és törölt dokumentumok száma, a chunkok száma, dokumentumonként a leghosszabb chunk hossza.

**Elfogadási feltételek**
- Az első `npm run ingest` minden dokumentumot és chunkot beszúr; a `chunks` táblában egyetlen sor `embedding`-je sem null.
- A második, változtatás nélküli futás kimenete: 0 új, 0 frissített, 0 törölt, és nem hív embedding API-t.
- Egy dokumentum módosítása után csak az az egy dokumentum frissül.
- Egy fájl törlése után a hozzá tartozó dokumentum és chunkjai eltűnnek az adatbázisból.

**Tesztelés**
- `npm run ingest` kétszer egymás után, a kimenetek összevetése.
- SQL: `select count(*) from chunks where embedding is null;` → 0; `select count(*) from chunks;` → egyezik a script által kiírt számmal.
- Egy dokumentum egy mondatának módosítása, újrafuttatás: „1 frissített”.

**Függőségek és kockázatok**
- Függőség: 3., 4. és 5. feladat.
- Kockázat: az OpenAI rate limit egy nagy első futásnál. 12–15 dokumentumnál a chunkok száma várhatóan 100 alatt marad, ami egy-két kérés; az `embedMany` beépített újrapróbálása (`maxRetries`, alapértelmezés 2) kezeli az átmeneti hibákat.
- Kockázat: ha az `EMBEDDING_MODEL` változik, a régi és az új embeddingek nem összevethetők. Modellváltáskor a `chunks` és a `documents` tábla ürítése után teljes újrafuttatás kell.

### 7. Hybrid search termék- és bankszűrővel

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | Hybrid search termék- és bankszűrővel | `src/lib/retrieval/search.ts` | Nincs keresés | A pontos kifejezéseket (THM, banknevek) csak a full-text keresés találja meg biztosan | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs keresés. A dokumentáció „Architektúra › Query pipeline” 3. lépése írja elő: vektoros és kulcsszavas keresés, csak a szűrőnek megfelelő chunkokon, top 20 találat. A „Forráshivatkozás és termékszűrés” szakasz SQL példája a termékszűrést mutatja (`c.products && ARRAY[...]`); a bankszűrő ugyanott, szövegesen szerepel.

**Probléma**
- A dokumentációban nincs megoldva, hogy a magyar, természetes nyelvű kérdés hogyan lesz full-text lekérdezés. A `websearch_to_tsquery` és a `plainto_tsquery` minden szót ÉS kapcsolattal köt össze, így egy hosszabb kérdésre („Mennyi a személyi kölcsön maximális futamideje?”) jellemzően nulla találatot ad.
- Szűrés mellett a HNSW index alapbeállítással (`hnsw.ef_search = 40`) kevesebb találatot adhat a kértnél, mert a szűrés az indexből kapott jelöltek után fut.

**Megoldás**
1. Típusok a `src/lib/retrieval/types.ts`-ben:
   - `Product = 'lakashitel' | 'szemelyi_kolcson' | 'bankszamla' | 'altalanos'`
   - `Filters = { product: Product | 'osszes'; bank: string | null }`
   - `Candidate = { id, slug, title, sectionPath, contextHeader, content, products, banks, sourceUrl, updatedAt }`
2. Közös szűrőfeltétel (`buildFilterSql(filters)`), Drizzle `sql` template-tel:
   - termék: ha nem `osszes` → `c.products && array[${product}, 'altalanos']::text[]`
   - bank: ha meg van adva → `(c.banks @> array[${bank}]::text[] or cardinality(c.banks) = 0)` – az általános, bankhoz nem kötött dokumentumok bankszűrésnél is megmaradnak.
3. `vectorSearch(embedding, filters, limit = 20)`: egy tranzakcióban először `set local hnsw.ef_search = 200`, utána:
   ```sql
   select ... from chunks c join documents d on d.id = c.document_id
   where <szűrő>
   order by c.embedding <=> ${JSON.stringify(embedding)}::vector
   limit 20
   ```
4. `fullTextSearch(question, filters, limit = 20)`:
   - A kérdésből a szavak kinyerése a `/[\p{L}\p{N}]+/gu` regexszel, a 2 karakternél rövidebbek elhagyásával.
   - VAGY kapcsolatú lekérdezés: a szavak ` | `-vel összefűzve, `to_tsquery('hungarian', ${orQuery})` – a magyar konfiguráció kiszűri a stopszavakat és szótövez.
   - Rendezés: `ts_rank_cd(c.tsv, query) desc`, `limit 20`.
   - Ha egyetlen szó sem marad, a függvény üres tömböt ad, adatbázis-hívás nélkül.
5. `hybridSearch(question, embedding, filters)`: a két keresés párhuzamosan (`Promise.all`), az eredmény a 8. feladat RRF-jébe megy.

**Elfogadási feltételek**
- Személyi kölcsön szűrővel (`szemelyi_kolcson`) csak olyan chunk jön vissza, amelynek `products` tömbje tartalmazza a `szemelyi_kolcson` vagy az `altalanos` értéket.
- Bankszűrővel csak az adott bank chunkjai és a bankhoz nem kötött chunkok jönnek vissza.
- Egy „Mennyi a személyi kölcsön maximális futamideje?” típusú kérdésre a full-text keresés legalább egy találatot ad, ha a tudásanyagban szerepel a „futamidő” szó.
- Mindkét keresés legfeljebb 20 találatot ad.

**Tesztelés**
- `scripts/search-check.ts`: három kérdés lefuttatása szűrő nélkül, termékszűrővel és bankszűrővel; kiírja mindkét lista slugjait és szakaszneveit.
- SQL Editorban a generált lekérdezés kézi futtatása egy szűrőkombinációval, a visszakapott `products` és `banks` oszlopok ellenőrzése.

**Függőségek és kockázatok**
- Függőség: 3. és 6. feladat (feltöltött adatbázis), 6. feladat `embedQuery` függvénye.
- Kockázat: a VAGY kapcsolat sok gyenge találatot hoz. Ez szándékos: a sorrendet az RRF és a rerank (8. és 9. feladat) javítja, a gyenge találatokat a küszöb szűri ki.
- Kockázat: ha a `set local` a transaction pooleren tranzakción kívül fut, hatástalan. Ezért a `vectorSearch` a `db.transaction()`-ön belül futtatja mindkét utasítást.

### 8. RRF összefésülés

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 8 | RRF összefésülés | `src/lib/retrieval/rrf.ts` | Nincs összefésülés | A vektoros és a full-text pontszám nem vethető össze közvetlenül | 🟠 komoly | S |

**Jelenlegi állapot**
Nincs implementáció. A dokumentáció „Query pipeline” 3. lépése Reciprocal Rank Fusion összefésülést ír elő, paraméterek nélkül.

**Probléma**
A koszinusz-távolság és a `ts_rank_cd` pontszám más skálán mozog. Összeadva vagy egyszerűen egymás után fűzve az egyik keresés mindig elnyomja a másikat, és a hybrid search előnye elvész.

**Megoldás**
1. `src/lib/retrieval/rrf.ts`, exportált függvény: `rrf(lists: Candidate[][], k = 60, limit = 20): Candidate[]`.
2. Minden listában a találat helyezése 1-től indul; egy chunk pontszáma `Σ 1 / (k + helyezés)` az összes listára, amelyben szerepel.
3. Duplikátumszűrés `id` alapján. Rendezés pontszám szerint csökkenő sorrendben; egyenlő pontszámnál az előbb előforduló találat nyer.
4. A visszaadott lista legfeljebb `limit` elemű.

**Elfogadási feltételek**
- Mindkét listában szereplő chunk megelőzi azt, amelyik csak az egyikben szerepel azonos helyezéssel.
- Egy chunk legfeljebb egyszer szerepel az eredményben.
- Üres bemeneti listák esetén üres tömb a kimenet.

**Tesztelés**
- Unit tesztek a 19. feladatban (`tests/rrf.test.ts`): átfedő listák, diszjunkt listák, egy üres lista, egyenlő pontszám.

**Függőségek és kockázatok**
- Függőség: 7. feladat (`Candidate` típus).
- Kockázat: nincs jelentős; a `k = 60` az RRF általánosan használt értéke, a rerank úgyis újrarendezi a listát.

### 9. LLM rerank és relevancia-küszöb

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | LLM rerank és relevancia-küszöb | `src/lib/retrieval/rerank.ts` | Nincs rerank és küszöb | Gyenge találatnál ez akadályozza meg a generálást | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs implementáció. A dokumentáció cross-encoder rerankert ír elő (Cohere Rerank vagy bge-reranker), a legjobb 5–6 találattal és relevancia-küszöbbel. A demó döntése: LLM-alapú rerank a `gpt-5.4-mini` modellel, 0–10 skálán, 6-os küszöbbel.

**Probléma**
Rerank és küszöb nélkül a generáló modell mindig kap forrást, akkor is, ha az csak témájában kapcsolódik. Ilyenkor nagy a kísértés, hogy a modell egy félig releváns szövegből rakjon össze választ. Ez pontosan az, amit az üzleti kérés tilt.

**Megoldás**
1. `src/lib/retrieval/rerank.ts`, exportált függvény: `rerank(question: string, candidates: Candidate[]): Promise<RankedCandidate[]>`, ahol `RankedCandidate = Candidate & { score: number }`.
2. Rövid azonosítók a promptban: `c1`…`c20` (UUID helyett), hogy a modell kevésbé tévesszen.
3. Hívás:
   ```ts
   const { output } = await generateText({
     model: openai(env.HELPER_MODEL),
     providerOptions: { openai: { reasoningEffort: 'low' } },
     output: Output.object({
       schema: z.object({
         scores: z.array(z.object({ id: z.string(), score: z.number() })),
       }),
     }),
     system: RERANK_SYSTEM_PROMPT,
     prompt: buildRerankPrompt(question, candidates),
   });
   ```
4. `RERANK_SYSTEM_PROMPT` pontozási skálája:
   - 9–10: a szöveg közvetlenül megválaszolja a kérdést;
   - 6–8: a válasz egy lényeges része benne van;
   - 3–5: csak a témához kapcsolódik, a választ nem tartalmazza;
   - 0–2: nem releváns.

   A promptban minden jelölt a `contextHeader`-rel és a `content` első 1500 karakterével szerepel.
5. Utófeldolgozás:
   - a hiányzó vagy ismeretlen azonosítójú jelölt pontszáma 0;
   - a pontszám `Math.round`-dal egészre, 0 és 10 közé szorítva;
   - szűrés `score >= env.RERANK_THRESHOLD` szerint, rendezés csökkenő sorrendben, legfeljebb 5 elem.
6. Ha a szűrés után nem marad jelölt, a pipeline (13. feladat) generálás nélkül `not_found` választ ad, `no_relevant_source` okkal.
7. A rerank séma szándékosan nem tartalmaz zod `min` / `max` megkötést: az OpenAI structured output szigorú módja nem minden JSON Schema kulcsszót fogad el, a tartomány ellenőrzése ezért a kódban történik.

**Elfogadási feltételek**
- Egy tudásanyagban szereplő kérdésre legalább egy jelölt 6 vagy afölötti pontszámot kap.
- Egy tudásanyagon kívüli kérdésre (pl. „Milyen kriptobefektetést ajánl a bank?”) egyetlen jelölt sem éri el a küszöböt, és a pipeline nem hívja a generáló modellt.
- A kimenet legfeljebb 5 elemű, pontszám szerint csökkenő.
- A küszöb a `RERANK_THRESHOLD` env változóval, kódmódosítás nélkül állítható.

**Tesztelés**
- `scripts/search-check.ts` kiegészítése: a hybrid search eredménye után a rerank pontszámainak kiírása egy releváns és egy tudásanyagon kívüli kérdésre.
- Az eval script (20. feladat) „helyes elutasítás” metrikája a 4 megválaszolhatatlan kérdésen ellenőrzi a küszöböt.

**Függőségek és kockázatok**
- Függőség: 7. és 8. feladat.
- Kockázat: az LLM rerank kérdésenként egy plusz hívás, kb. 1–3 másodperc késleltetéssel. Ezért fut a gyorsabb `gpt-5.4-mini` modellen.
- Kockázat: ha a rerank hívás hibával tér vissza, a pipeline `error` eseményt ad, és nem generál válasz forrásellenőrzés nélkül.

### 10. Follow-up query rewrite

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | Follow-up query rewrite | `src/lib/retrieval/rewrite.ts` | Nincs | Előzmény nélkül az „És mennyi a futamidő?” kérdés nem kereshető | 🟠 komoly | S |

**Jelenlegi állapot**
Nincs implementáció. A dokumentáció „Query pipeline” 2. lépése írja le a célt a „És mennyi a futamidő?” → „Mennyi a személyi kölcsön futamideje?” példával. A demóban az előzmény kliens oldalon tárolódik, és minden kéréssel megérkezik.

**Probléma**
A follow-up kérdés önmagában nem tartalmazza a terméket vagy a bankot. A keresés ilyenkor rossz vagy semmilyen forrást nem talál, és a rendszer indokolatlanul „nincs forrás” választ ad.

**Megoldás**
1. `src/lib/retrieval/rewrite.ts`, exportált függvény: `rewriteQuery(question: string, history: ChatTurn[]): Promise<string>`, ahol `ChatTurn = { role: 'user' | 'assistant'; content: string }`.
2. Üres előzménynél a függvény LLM-hívás nélkül, változatlanul adja vissza a kérdést.
3. Egyébként `generateText` a `HELPER_MODEL`-lel, `reasoningEffort: 'low'` beállítással. A prompt az utolsó 6 üzenetet és az új kérdést tartalmazza, ezzel az utasítással: „Fogalmazd át a legutóbbi kérdést önálló, az előzmények nélkül is érthető kérdéssé. Ha már önálló, változatlanul add vissza. Csak a kérdést írd ki, magyarázat nélkül.”
4. Utófeldolgozás: `trim()`; ha az eredmény üres vagy 500 karakternél hosszabb, az eredeti kérdés megy tovább.
5. Az átírt kérdést használja a keresés, a rerank és a generálás is. A pipeline `rewrite` eseményben elküldi a UI-nak, ha eltér az eredetitől (16. feladat megjeleníti).

**Elfogadási feltételek**
- Első kérdésnél nincs LLM-hívás (a konzolnaplóban nem jelenik meg rewrite hívás).
- „Mennyi a személyi kölcsön maximális futamideje?” után az „És a minimális összeg?” kérdés átírt változata tartalmazza a „személyi kölcsön” kifejezést.
- Önálló kérdés follow-upként érkezve tartalmilag változatlan marad.

**Tesztelés**
- `scripts/rewrite-check.ts`: két előre megírt beszélgetés (egy függő és egy önálló follow-up), az átírt kérdések kiírása.
- A főpróbán (23. feladat) egy follow-up kérdés élőben.

**Függőségek és kockázatok**
- Függőség: 1. feladat (env, AI SDK).
- Kockázat: a modell válaszolni kezd a kérdésre átírás helyett. Ezt az 500 karakteres korlát fogja meg, és a prompt kifejezetten tiltja.

### 11. System prompt és structured output séma

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | System prompt és structured output séma | `src/lib/generation/prompt.ts`, `src/lib/generation/schema.ts` | A dokumentáció „Temperature 0”-t ír elő, ez a GPT-5 családnál nem alkalmazható; a `streamObject` deprecated | Ez köti a választ a forrásokhoz | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs implementáció. A dokumentáció „Pontosság és megbízhatóság” szakasza tartalmazza a system prompt 7 szabályát (Bankmonitor-specifikus változatban), a JSON sémát (`status`, `answer`, `citations [{sourceId, quote}]`) és a „Temperature 0” előírást.

**Probléma**
- A GPT-5 család a temperature paramétert nem kezeli úgy, mint a korábbi modellek; a 0 érték nem állítható be megbízhatóan. Ha a kód mégis átadja, a hívás hibával vagy figyelmen kívül hagyott paraméterrel fut.
- Az AI SDK 6 óta a `streamObject` deprecated; a structured streaming a `streamText` + `Output.object` páros, a részleges eredmény a `partialOutputStream`-ből jön.
- A dokumentáció nem rögzíti, milyen formában kapja meg a modell a forrásokat, így nem garantált, hogy a `sourceId` értékek egyértelműen visszakereshetők.

**Megoldás**
1. `src/lib/generation/schema.ts`:
   ```ts
   export const answerSchema = z.object({
     status: z.enum(['answered', 'partial', 'not_found']),
     answer: z.string(),
     citations: z.array(z.object({ sourceId: z.number(), quote: z.string() })),
   });
   export type ModelAnswer = z.infer<typeof answerSchema>;

   export const NOT_FOUND_MESSAGE =
     'Erre a kérdésre nem találtam megbízható forrást a tudásbázisban. Ellenőrizd a kérdést vagy a szűrőket.';
   ```
   Zod `min` / `max` megkötés itt sincs (ld. 9. feladat 7. pont); minden tartalmi ellenőrzés a 12. feladat validátorában történik.
2. `src/lib/generation/prompt.ts`, `SYSTEM_PROMPT` konstans – a dokumentáció 7 szabálya, kiegészítve:
   - minden ténymegállapítást tartalmazó mondat végén `[n]` jelölő, ahol `n` a forrás sorszáma;
   - minden hivatkozott forráshoz egy `citations` elem, amelynek `quote` mezője a forrás szövegéből szó szerint, betűre pontosan másolt, legfeljebb 300 karakteres részlet;
   - `status = 'partial'`, ha a forrásokban csak a válasz egy része szerepel; ilyenkor a válasz kimondja, mi hiányzik;
   - `status = 'not_found'` esetén az `answer` üres string és a `citations` üres tömb.
3. `buildUserPrompt(question: string, sources: RankedCandidate[]): string` formátuma:
   ```text
   <források>
   <forrás id="1" cím="..." szakasz="..." bank="..." frissítve="YYYY-MM-DD">
   ...chunk content...
   </forrás>
   ...
   </források>

   Kérdés: ...
   ```
   A sorszám a rerank sorrendjében 1-től indul; ugyanez a sorszám kerül a UI forráskártyáira.
4. Modellhívás beállításai (a 13. feladat pipeline-ja használja): `model: openai(env.GENERATION_MODEL)`, `providerOptions: { openai: { reasoningEffort: 'low' } }`, `output: Output.object({ schema: answerSchema })`. Temperature paraméter nincs a kódban.

**Elfogadási feltételek**
- A kódbázisban nincs `temperature` paraméter és nincs `streamObject` / `generateObject` hívás (`grep` ellenőrzés).
- A `buildUserPrompt` kimenetében a források 1-től folytonosan számozottak, minden forrásnál szerepel a cím, a szakasz, a bank és a frissítés dátuma.
- Egy releváns kérdésre a modell kimenete átmegy az `answerSchema.safeParse` ellenőrzésen.

**Tesztelés**
- `grep -rn "temperature\|streamObject\|generateObject" src scripts` – üres kimenet.
- `scripts/generate-check.ts`: egy kérdés a teljes retrievalon keresztül, a nyers modellkimenet kiírása, a `[n]` jelölők és a `citations` szemrevételezése.

**Függőségek és kockázatok**
- Függőség: 9. feladat (`RankedCandidate`).
- Kockázat: `reasoningEffort: 'low'` mellett a modell ritkábban ellenőrzi magát. Ezt a validátor (12. feladat) kompenzálja; ha az eval sok validációs hibát mutat, a `'medium'` érték a következő lépés, nagyobb késleltetés árán.

### 12. Idézet-validátor, újrapróba, not_found

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 12 | Idézet-validátor, újrapróba, not_found | `src/lib/generation/validate.ts` | Nincs | Ez a kódból ellenőrzött garancia arra, hogy hibás információ nem megy ki | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs implementáció. A dokumentáció „Pontosság és megbízhatóság” 6. pontja három ellenőrzést ír le (sourceId létezik, idézet szó szerint szerepel, számok szerepelnek a forrásban), hiba esetén egy újragenerálással, majd elutasítással. A demóból a szám-ellenőrzés kimarad.

**Probléma**
Validálás nélkül a „minden állításnál látszik a forrás” csak a modell jóindulatán múlik: a modell kitalálhat idézetet, vagy olyan sorszámra hivatkozhat, amelyik nem létezik. A szakértő ilyenkor egy hihető, de forrással alá nem támasztott választ lát.

**Megoldás**
1. `src/lib/generation/validate.ts`, `normalize(text: string): string`:
   - `text.normalize('NFC')`;
   - a `„ ” “ " ' ’ ‘` karakterek egységesen `"`-re cserélve, a `– —` karakterek `-`-re;
   - `\s+` → egy szóköz, `trim()`, `toLocaleLowerCase('hu')`.
2. `validateAnswer(output: ModelAnswer, sources: RankedCandidate[]): { ok: true } | { ok: false; errors: string[] }`:
   - `status = 'not_found'` → mindig `ok`.
   - `answered` / `partial` esetén minden hiba összegyűjtve:
     - legalább egy `citations` elem van;
     - minden `sourceId` egész szám 1 és `sources.length` között;
     - minden `quote` normalizálva legalább 10 karakter, és részstringje a hivatkozott forrás normalizált `content`-jének;
     - a válaszban van legalább egy `[n]` jelölő (`/\[(\d+)\]/g`);
     - minden `[n]` jelölőhöz tartozik `citations` elem azonos `sourceId`-val, és minden `citations` elem `sourceId`-ja előfordul jelölőként a válaszban.
3. Újrapróba és elutasítás a 13. feladat pipeline-jában:
   - első hiba esetén egy újragenerálás `generateText`-tel (nem streamelve), a promptot kiegészítve ezzel: „Az előző válaszod nem felelt meg a szabályoknak: <hibák listája>. Javítsd, és csak a forrásokból szó szerint idézz.”;
   - ha a második válasz is hibás → `not_found` státusz, `NOT_FOUND_MESSAGE` szöveg, `validation_failed` ok; a hibák `console.warn`-nal naplózódnak.
4. A modell saját `not_found` válaszánál a végleges szöveg szintén a `NOT_FOUND_MESSAGE`, `model_not_found` okkal.

**Elfogadási feltételek**
- Kitalált idézet (a forrásban nem szereplő szöveg) → `ok: false`, a hibalista megnevezi a citációt.
- Nem létező `sourceId` (pl. 7, ha 5 forrás van) → `ok: false`.
- Jelölő nélküli állítás vagy citáció nélküli jelölő → `ok: false`.
- Az idézet tipográfiai eltérései (idézőjel típusa, sortörés, kis- és nagybetű) nem okoznak hibát.
- Kétszeri sikertelen validálás után a felhasználó a `NOT_FOUND_MESSAGE`-et látja, nem a hibás választ.

**Tesztelés**
- Unit tesztek a 19. feladatban (`tests/validate.test.ts`), minden fenti elfogadási feltételre egy-egy eset.
- Az eval script (20. feladat) „citation accuracy” metrikája ugyanezt a validátort futtatja minden válaszon.

**Függőségek és kockázatok**
- Függőség: 11. feladat (`ModelAnswer`, `NOT_FOUND_MESSAGE`).
- Kockázat: túl szigorú egyezésnél (pl. a modell egy szót kihagy az idézetből) sok helyes válasz is elutasításra kerül. Ha az eval ezt mutatja, a prompt idézési szabályát kell szigorítani, nem a validátort lazítani.
- Kockázat: az újrapróba plusz 3–8 másodperc. Ez csak hibás első válasznál jelentkezik.

### 13. Közös pipeline függvény

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 13 | Közös pipeline függvény | `src/lib/pipeline.ts` | Nincs | Az API és az eval script ugyanazt a logikát futtatja, így az eval a valós működést méri | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs implementáció. A dokumentáció a lépéseket („Query pipeline” 1–9.) és a repo struktúrában külön fájlokat (`retrieval.ts`, `generate.ts`, `validate.ts`) ír le, de azt nem, mi fűzi őket össze, és hogyan használja ugyanazt a logikát az API és az eval script.

**Probléma**
Ha az API route és az eval script külön-külön rakja össze a lépéseket, a kettő idővel eltér egymástól, és az eval már nem azt méri, amit a felhasználó lát. A streaming és a validálás sorrendje is ebben a rétegben dől el.

**Megoldás**
1. `src/lib/pipeline.ts`, eseménytípusok:
   ```ts
   export type PipelineEvent =
     | { type: 'rewrite'; query: string }
     | { type: 'partial'; answer: string }
     | { type: 'final'; result: FinalResult }
     | { type: 'error'; message: string };

   export type FinalResult = {
     status: 'answered' | 'partial' | 'not_found';
     answer: string;
     reason?: 'no_relevant_source' | 'validation_failed' | 'model_not_found';
     citations: {
       n: number;
       quote: string;
       source: Pick<Candidate, 'slug' | 'title' | 'sectionPath' | 'content' | 'sourceUrl' | 'products' | 'banks' | 'updatedAt'>;
     }[];
     retrieved: { slug: string; score: number }[];
   };
   ```
2. Exportált függvény: `async function* answerQuestion(input: { question: string; filters: Filters; history: ChatTurn[] }): AsyncGenerator<PipelineEvent>`.
3. Lépések:
   1. `rewriteQuery` (10.) → ha eltér, `rewrite` esemény;
   2. `embedQuery` (6.) → `hybridSearch` (7.) → `rrf` (8.) → `rerank` (9.);
   3. üres rerank-eredmény → `final` esemény `not_found` státusszal, `no_relevant_source` okkal, generálás nélkül;
   4. `streamText` a 11. feladat beállításaival; a `partialOutputStream` minden elemére, ha az `answer` mező változott, `partial` esemény az aktuális szöveggel;
   5. a stream végén az utolsó részleges objektum `answerSchema.safeParse`-szal ellenőrizve, majd `validateAnswer` (12.);
   6. hiba esetén egy újragenerálás `generateText`-tel, újravalidálás; második hiba → `not_found`, `validation_failed`;
   7. `final` esemény a validált válasszal; a `citations` a forrás metaadataival kiegészítve, a `retrieved` a rerank utáni slugokkal és pontszámokkal.
4. Az egész generátor `try/catch`-ben fut: kivétel esetén `console.error` és `error` esemény ezzel a szöveggel: „Hiba történt a válasz előállítása közben. Próbáld újra.”
5. A pipeline nem ismeri a HTTP-t: a 14. feladat API route-ja NDJSON-ná alakítja az eseményeket, a 20. feladat eval scriptje pedig csak a `final` eseményt olvassa.

**Elfogadási feltételek**
- Egy releváns kérdésre az események sorrendje: (`rewrite`), legalább egy `partial`, végül egy `final` `answered` vagy `partial` státusszal.
- Tudásanyagon kívüli kérdésre: egyetlen `final` esemény `not_found` státusszal és `no_relevant_source` okkal, `partial` esemény nélkül.
- Minden lefutás pontosan egy `final` vagy egy `error` eseménnyel zárul.
- A `final.retrieved` legfeljebb 5 elemű.

**Tesztelés**
- `scripts/pipeline-check.ts`: egy releváns, egy tudásanyagon kívüli és egy follow-up kérdés; az események típusának és sorrendjének kiírása.
- Az eval script (20. feladat) 15 kérdésen futtatja ugyanezt a függvényt.

**Függőségek és kockázatok**
- Függőség: 6., 7., 8., 9., 10., 11. és 12. feladat.
- Kockázat: a `partial` események a validálás előtt jelennek meg a UI-on, így a felhasználó pár másodpercig validálatlan szöveget lát. Ez a „stream, végén validál” döntés vállalt ára; a UI ezt jelzi (17. feladat), és hiba esetén lecseréli a szöveget.
- Kockázat: egy kérdés teljes ideje (rewrite + embedding + két keresés + rerank + generálás + esetleges újrapróba) 10–25 másodperc is lehet. A 14. feladat ezért emeli meg a route `maxDuration` értékét.

### 14. Streaming chat végpont

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 14 | Streaming chat végpont | `src/app/api/chat/route.ts` | Nincs | A UI ezen keresztül kap részleges választ és végleges, validált eredményt | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs végpont. A dokumentáció „Adatmodell és API” táblázata szerint `POST /api/chat`: kérdés + `product?` + `conversationId?`, SSE streaming. A demóban `conversationId` helyett a kliens küldi az előzményt, és a végén validált `final` esemény érkezik.

**Probléma**
- Bemeneti validálás nélkül egy túl hosszú kérdés vagy előzmény feleslegesen drága modellhívást indít, egy hibás szűrőérték pedig SQL-szinten okozhat hibát.
- Vercelen a függvény alapértelmezett időkorlátja elvághatja a 10–25 másodperces folyamatot.
- Ha a kliens bezárja a kapcsolatot, a pipeline tovább futna és fizetős hívásokat indítana.

**Megoldás**
1. Route konfiguráció: `export const runtime = 'nodejs';` (a `postgres` driver Node.js-t igényel) és `export const maxDuration = 60;`.
2. Kérés validálása zod sémával:
   - `question`: `z.string().trim().min(1).max(1000)`
   - `product`: `z.enum(['osszes', 'lakashitel', 'szemelyi_kolcson', 'bankszamla'])`
   - `bank`: `z.string().max(100).nullable()`
   - `history`: `z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(6)`

   Hibás kérésnél `400` státusz, `{ error: string }` JSON törzzsel.
3. Válasz NDJSON streamként (soronként egy JSON esemény), az SSE helyett, mert a kliens POST kérést küld, a natív `EventSource` pedig csak GET-et tud:
   ```ts
   const encoder = new TextEncoder();
   const stream = new ReadableStream({
     async start(controller) {
       const events = answerQuestion({ question, filters: { product, bank }, history });
       for await (const event of events) {
         if (request.signal.aborted) { await events.return(undefined); break; }
         controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
       }
       controller.close();
     },
   });
   return new Response(stream, {
     headers: {
       'Content-Type': 'application/x-ndjson; charset=utf-8',
       'Cache-Control': 'no-cache, no-transform',
     },
   });
   ```

**Elfogadási feltételek**
- `set -a; source .env.local; set +a`, majd `curl -N -u "$DEMO_USER:$DEMO_PASSWORD" -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"question":"Mennyi a személyi kölcsön maximális futamideje?","product":"szemelyi_kolcson","bank":null,"history":[]}'` soronként érkező JSON eseményeket ad, és `final` eseménnyel zárul.
- Üres kérdés vagy 6-nál hosszabb előzmény → `400`.
- A válasz `Content-Type` fejléce `application/x-ndjson`.
- Ha a kliens megszakítja a kérést, a szerver konzolján nem jelenik meg utána újabb modellhívás.

**Tesztelés**
- A fenti `curl` parancs, valamint egy hibás törzsű kérés (`"question":""`).
- Böngészőből a 16. feladat UI-jával: a válasz fokozatosan jelenik meg.

**Függőségek és kockázatok**
- Függőség: 13. feladat; a Basic Auth (18. feladat) után a `curl`-nek is kell a `-u` kapcsoló.
- Kockázat: ha a stream egy köztes réteg (pl. tömörítés) miatt pufferelődik, a részleges válasz egyszerre érkezik. A `no-transform` fejléc ezt kerüli el; ha mégis előfordul, a 23. feladat főpróbája megmutatja.

### 15. Banklista végpont

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | Banklista végpont | `src/app/api/banks/route.ts` | Nincs | A bankszűrő opciói az adatból jönnek, nem kézzel karbantartott listából | 🟡 csiszolás | S |

**Jelenlegi állapot**
Nincs végpont. A dokumentáció „Feltételezések és Bankmonitor-specifikus szempontok” része bankszűrőt ír elő, de nem mondja meg, honnan jönnek a választható bankok.

**Probléma**
Kézzel beírt listánál a szűrő eltérhet a tudásanyagtól: olyan bank is választható lenne, amelyről nincs dokumentum (mindig „nincs forrás”), vagy hiányozna egy, amelyről van.

**Megoldás**
1. `GET /api/banks`: `select distinct unnest(banks) as bank from chunks order by bank;` → `{ banks: string[] }`.
2. `export const dynamic = 'force-dynamic';`, hogy a lista ne a build idején rögzüljön, hanem egy újabb ingest után is friss legyen.

**Elfogadási feltételek**
- A végpont pontosan azokat a bankneveket adja vissza, amelyek a dokumentumok `banks` front matter mezőiben szerepelnek, ábécérendben, ismétlés nélkül.
- Egy új bankot tartalmazó dokumentum ingestje után a lista újratelepítés nélkül bővül.

**Tesztelés**
- `curl -u "$DEMO_USER:$DEMO_PASSWORD" http://localhost:3000/api/banks` (a változók a `set -a; source .env.local; set +a` paranccsal töltődnek be), az eredmény összevetése a `data/docs/` front matterjeivel.

**Függőségek és kockázatok**
- Függőség: 6. feladat (feltöltött adatbázis).
- Kockázat: nincs jelentős.

### 16. Chat felület szűrőkkel és előzménnyel

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | Chat felület szűrőkkel és előzménnyel | `src/app/page.tsx`, `src/components/FilterBar.tsx`, `src/components/ChatInput.tsx` | Nincs | Ezt látja az interjúztató | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs felület. A dokumentáció „Követelmények › Must have” része rögzíti: magyar kérdés, streaming válasz, termékszűrő (lakáshitel, személyi kölcsön, bankszámla, összes); a „Pontosság és megbízhatóság” 8. pontja a figyelmeztető szöveget.

**Probléma**
Az NDJSON stream feldolgozása nem triviális: a hálózati darabok nem esnek egybe a sorhatárokkal. Puffer nélkül a JSON parse elszáll, és a válasz félbeszakad.

**Megoldás**
1. `src/app/page.tsx` (`'use client'`), állapot:
   - `messages: UiMessage[]`, ahol `UiMessage = { id; role: 'user' | 'assistant'; content: string; phase: 'streaming' | 'done' | 'error'; rewrittenQuery?: string; result?: FinalResult }`;
   - `filters: Filters` (alapértelmezés: `{ product: 'osszes', bank: null }`);
   - `isLoading: boolean`.
2. Küldéskor:
   - az előzmény az eddigi üzenetekből készül, az utolsó 6 elem; az asszisztens üzeneteinél csak a végleges `result.answer` kerül bele, a hibás és `not_found` válaszok kimaradnak;
   - `fetch('/api/chat', { method: 'POST', body })`, a törzs olvasása `response.body.getReader()` + `TextDecoder`-rel;
   - pufferelés: a beérkező szöveg a pufferhez fűződik, a teljes sorok (`\n`) feldolgozódnak, a maradék a pufferben marad;
   - események: `rewrite` → `rewrittenQuery`; `partial` → `content`; `final` → `result` és `content`, `phase: 'done'`; `error` → `phase: 'error'` és a hibaüzenet.
3. `FilterBar.tsx`: két shadcn `Select`:
   - Termék: Összes / Lakáshitel / Személyi kölcsön / Bankszámla → `osszes` / `lakashitel` / `szemelyi_kolcson` / `bankszamla`;
   - Bank: „Minden bank” + a `/api/banks` (15. feladat) listája, betöltés a komponens mountolásakor.

   A szűrő a következő kérdésre vonatkozik; változtatása nem törli a beszélgetést. Egy „Új beszélgetés” gomb üríti az üzeneteket.
4. `ChatInput.tsx`: shadcn `Textarea`; Enter küld, Shift+Enter új sor; betöltés alatt tiltott. Alatta a figyelmeztetés: „AI által generált válasz. Ügyfél-tájékoztatás előtt ellenőrizd a forrást.”
5. Fejléc: „Tudásbázis asszisztens” cím, alatta „Bankmonitor demó”.
6. Átírt follow-up kérdésnél a válasz fölött kis, szürke sor: „Keresett kérdés: …”.

**Elfogadási feltételek**
- Egy kérdés elküldése után a válasz fokozatosan jelenik meg, majd a forráskártyák is megérkeznek (17. feladat).
- A termék- és bankszűrő értéke a kérés törzsében megérkezik (böngésző Network fül).
- Follow-up kérdésnél megjelenik a „Keresett kérdés” sor.
- Az „Új beszélgetés” után a következő kérés `history` mezője üres tömb.
- Hálózati vagy szerverhiba esetén hibaüzenet jelenik meg, és a beviteli mező újra használható.

**Tesztelés**
- Kézi teszt `npm run dev` mellett: egy kérdés szűrő nélkül, egy szűrővel, egy follow-up, egy „Új beszélgetés” utáni kérdés.
- Lassú hálózat szimulálása a böngésző DevTools „Slow 4G” beállításával: a stream feldolgozása ekkor sem törik el.

**Függőségek és kockázatok**
- Függőség: 14. és 15. feladat.
- Kockázat: a felület ideje könnyen elszalad a csinosítással. A 12 órás keretben a shadcn alapkomponensek alapstílusa elég; egyedi design nincs a scope-ban.

### 17. Válasz, hivatkozás-jelölők és forráskártyák

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | Válasz, hivatkozás-jelölők és forráskártyák | `src/components/AnswerView.tsx`, `src/components/SourceCard.tsx` | Nincs | Az üzleti kérés kifejezetten kéri, hogy látszódjon a forrás | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs implementáció. A dokumentáció „Forráshivatkozás és termékszűrés › Forráshivatkozás” része írja le: inline jelölők, forráskártya címmel, fejezettel, verzióval, termékcímkével, kiemelt idézettel és linkkel az eredetire. A demóban verzió helyett a frissítés dátuma szerepel, a link a Bankmonitor cikkre mutat.

**Probléma**
A validálás előtt streamelt szöveg és a végleges, ellenőrzött válasz között a felhasználónak látnia kell a különbséget. Ha a UI nem jelzi, hogy a szöveg még ellenőrzés alatt áll, és hiba esetén nem cseréli le, a „stream, végén validál” döntés pont a lényeget, a megbízhatóságot gyengíti.

**Megoldás**
1. `AnswerView.tsx` állapotjelzői (shadcn `Badge`):
   - `phase: 'streaming'` → szürke „Ellenőrzés folyamatban…”;
   - `answered` → zöld „Forrással ellenőrizve”;
   - `partial` → borostyán „Részleges válasz”;
   - `not_found` → a `NOT_FOUND_MESSAGE` keretes figyelmeztetésként, alatta az ok: `no_relevant_source` → „Nincs elég releváns forrás a tudásbázisban”; `validation_failed` → „A válasz nem ment át a forrásellenőrzésen”; `model_not_found` → „A források nem tartalmazzák a választ”.

   `final` eseménynél a streamelt szöveget mindig a végleges szöveg váltja fel.
2. Jelölők: a válasz szövegének felbontása a `/\[(\d+)\]/` regex mentén; a `[n]` helyén kattintható `Badge`, amely a `source-<üzenet id>-<n>` azonosítójú kártyához görget, és 1,5 másodpercre kiemeli.
3. `SourceCard.tsx`, a `citations` `n` szerint csoportosítva (egy forrás egy kártya, akár több idézettel):
   - fejléc: `[n]` + a dokumentum címe; alatta a `sectionPath`;
   - címkék: termékek magyar néven, bankok;
   - „Frissítve: YYYY-MM-DD”;
   - link: „Megnyitás a Bankmonitoron” (`target="_blank" rel="noopener noreferrer"`);
   - törzs: a chunk szövege shadcn `ScrollArea`-ban (max. 16rem magas), az idézet `<mark>`-kal kiemelve. A kereséshez az idézet és a szöveg is `toLocaleLowerCase('hu')`-val kerül összevetésre; ha a tipográfiai eltérések miatt nincs pontos találat, az idézet a szöveg fölött, külön blokkban jelenik meg.

**Elfogadási feltételek**
- Minden `[n]` jelölő kattintható, és a megfelelő kártyához görget.
- Minden kártyán ott a cím, a szakasz, a frissítés dátuma, a Bankmonitor link és a kiemelt idézet.
- Streamelés közben „Ellenőrzés folyamatban…” látszik, a végén az állapotnak megfelelő jelzés.
- `validation_failed` esetén a korábban streamelt szöveg eltűnik, helyén a `NOT_FOUND_MESSAGE` látszik.

**Tesztelés**
- Kézi teszt a 23. feladat szcenárióival.
- A `validation_failed` ág kipróbálása: a `src/lib/generation/validate.ts`-ben ideiglenesen `{ ok: false, errors: ['teszt'] }` visszatérés, egy kérdés elküldése, majd a módosítás visszaállítása. A visszaállítást a `git diff` üres kimenete igazolja.

**Függőségek és kockázatok**
- Függőség: 16. feladat, 13. feladat (`FinalResult`).
- Kockázat: ha a modell egymás után sok jelölőt tesz (`[1][2][3]`), a felület zsúfolt lesz. Ez megjelenítési kérdés, a pontosságot nem érinti.

### 18. Basic Auth védelem

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 18 | Basic Auth védelem | `src/proxy.ts` | A nyilvános URL-en bárki a te OpenAI kulcsodat használná | Költség- és visszaélési kockázat | 🟠 komoly | S |

**Jelenlegi állapot**
Nincs védelem. A dokumentáció „Tech stack javaslat” táblázata szerint a demóban nincs auth; ez a nyilvános Vercel URL és a publikus repó miatt megváltozott. A Next.js 16-ban a `middleware.ts` neve `proxy.ts`, az exportált függvényé `proxy`.

**Probléma**
A publikus repóból bárki megtalálja a demó URL-jét, és védelem nélkül korlátlanul futtathatja a `gpt-5.5` hívásokat a te számládra.

**Megoldás**
1. `src/proxy.ts` (a `src` mappában, mert a projekt `--src-dir` kapcsolóval készült):
   - a `DEMO_USER` és a `DEMO_PASSWORD` `process.env`-ből; ha bármelyik hiányzik, `500` válasz „Hiányzó szerverkonfiguráció” szöveggel (zárt alapállapot);
   - az `Authorization: Basic …` fejléc dekódolása `atob`-bal; a felhasználónév és a jelszó az első `:` mentén válik szét (`indexOf`), hogy `:`-ot tartalmazó jelszó is működjön;
   - összehasonlítás `crypto.timingSafeEqual`-lal (`node:crypto`), előtte egyenlő hossz ellenőrzése;
   - sikertelen hitelesítésnél `401`, `WWW-Authenticate: Basic realm="kb-assistant", charset="UTF-8"` fejléccel, hogy a böngésző felkínálja a bejelentkezést.
2. Matcher: `export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };` – az oldal és az összes API végpont védett.
3. A böngésző ugyanarra az originre küldött `fetch` kéréseknél automatikusan újraküldi a megadott Basic Auth adatokat, ezért a UI-ban nincs teendő.

**Elfogadási feltételek**
- Hitelesítés nélkül az oldal `401`-et ad, és a böngésző bejelentkezési ablakot mutat.
- Hibás jelszóval `401`, helyessel betölt az oldal, és a chat működik.
- `curl http://localhost:3000/api/chat` hitelesítés nélkül `401`.
- Hiányzó `DEMO_PASSWORD` esetén `500`, nem nyitott oldal.

**Tesztelés**
- Böngészőben: privát ablakban megnyitás, rossz, majd jó jelszó.
- `curl -i http://localhost:3000/api/banks` (401) és `curl -i -u "$DEMO_USER:$DEMO_PASSWORD" http://localhost:3000/api/banks` (200), a változók betöltése után (`set -a; source .env.local; set +a`).

**Függőségek és kockázatok**
- Függőség: 1. feladat.
- Kockázat: a jelszó nem kerülhet a repóba és a README-be; az interjúztatónak külön üzenetben kell elküldeni.
- Kockázat: a `proxy.ts` a Next.js 16-tól érvényes elnevezés. Ha a `create-next-app` régebbi főverziót telepít, a fájl `middleware.ts`, a függvény `middleware`; a `npm run build` kimenete jelzi, ha a fájlt a Next.js nem ismerte fel.

### 19. Vitest unit tesztek

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 19 | Vitest unit tesztek | `vitest.config.ts`, `tests/` | Nincs teszt | A validátor egy hibája csendben átengedné a hallucinációt | 🟠 komoly | S |

**Jelenlegi állapot**
Nincs teszt. A dokumentáció „Minőségbiztosítás › Tesztelés és CI” része unit teszteket ír elő a chunkingra, a szűrésre, az idézet-validátorra és a számellenőrzőre. A demóban a számellenőrző kimarad, a szűrést a 7. feladat check scriptje és az eval fedi le.

**Probléma**
A validátor a pontosság utolsó védvonala. Ha egy normalizálási hiba miatt például minden idézetet elfogad, az élesben nem tűnik fel, mert a válaszok jól néznek ki.

**Megoldás**
1. `vitest.config.ts`: `test.environment: 'node'`, alias `@` → `path.resolve(__dirname, 'src')`.
2. `tests/validate.test.ts` (6 eset):
   - helyes válasz → `ok`;
   - kitalált idézet → hiba;
   - nem létező `sourceId` → hiba;
   - jelölő citáció nélkül → hiba;
   - citáció jelölő nélkül → hiba;
   - tipográfiai eltérés (`„…”` vs `"…"`, sortörés, nagybetű) → `ok`.
3. `tests/rrf.test.ts` (4 eset): átfedő listák, diszjunkt listák, egy üres lista, egyenlő pontszám sorrendje.
4. `tests/chunk.test.ts` (4 eset): címsor szerinti szakaszolás és `sectionPath`, hosszú szakasz darabolása átfedéssel, ép táblázat, rövid szakasz összevonása. A bemenet a tesztfájlban definiált markdown string.
5. A `validate.ts`, `rrf.ts` és `chunk.ts` modul nem importálja a `src/lib/env.ts`-t és az adatbázis-klienst, így a tesztek környezeti változók nélkül futnak.

**Elfogadási feltételek**
- `npm test` mind a 14 tesztet lefuttatja, mind zöld.
- A tesztek `.env.local` nélkül is futnak.

**Tesztelés**
- `npm test`.
- Ellenőrzés, hogy a teszt tényleg fog hibát: a `normalize` függvényben ideiglenesen kikapcsolt kisbetűsítés mellett a tipográfiai teszt bukik; utána visszaállítás.

**Függőségek és kockázatok**
- Függőség: 5., 8. és 12. feladat.
- Kockázat: ha a tesztelt modulok mégis importálják az `env.ts`-t, a tesztek a hiányzó változók miatt elbuknak. A 5. pont ezt zárja ki.

### 20. Eval script a golden setre

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | Eval script a golden setre | `scripts/eval.ts` | Nincs mérés | Számokkal mutatod meg a pontosságot az interjún | 🟠 komoly | S |

**Jelenlegi állapot**
Nincs eval. A dokumentáció „Minőségbiztosítás › Metrikák” táblázata hat metrikát sorol fel; a demóban az automatikusan mérhetők maradnak (LLM-as-judge nélkül). A célszámok a „Követelmények › Nem-funkcionális” táblázatból: hivatkozás-pontosság ≥ 98%, helyes elutasítás ≥ 90%.

**Probléma**
Mérés nélkül a „pontos” állítás az interjún csak szó. Az eval azt is megmutatja, ha a küszöb (9. feladat) túl szigorú vagy túl engedékeny.

**Megoldás**
1. `scripts/eval.ts`:
   - `data/golden-set.json` betöltése;
   - tételenként `answerQuestion` (13. feladat) a tétel `product` értékével (hiányzásakor `osszes`) és `bank` értékével (hiányzásakor `null`), üres előzménnyel; csak a `final` esemény kerül feldolgozásra;
   - a kérdések egymás után futnak, nem párhuzamosan, hogy ne fusson bele az OpenAI rate limitbe.
2. Metrikák:
   - **recall@5** (megválaszolható tételek): azon tételek aránya, ahol az `expected_sources` legalább egy eleme szerepel a `final.retrieved` slugjai között;
   - **citation accuracy** (`answered` / `partial` válaszok): azon citációk aránya, amelyek `source.slug`-ja szerepel az `expected_sources`-ban;
   - **helyes elutasítás** (megválaszolhatatlan tételek): a `not_found` státuszú válaszok aránya;
   - **válaszadási arány** (megválaszolható tételek): az `answered` vagy `partial` státuszú válaszok aránya – ez mutatja a téves elutasításokat.
3. Kimenet:
   - `console.table` tételenként: `id`, státusz, ok, recall találat, citációk száma és helyessége;
   - összesítő táblázat a négy metrikával, mellette a dokumentáció célszámaival (citation accuracy ≥ 98%, helyes elutasítás ≥ 90%);
   - `eval/results.json` a futás dátumával, a modellnevekkel, a `RERANK_THRESHOLD` értékével és az eredményekkel. Ez a fájl commitolódik, a README (22. feladat) ebből idéz.

**Elfogadási feltételek**
- `npm run eval` mind a 15 tételt lefuttatja hiba nélkül, és kiírja a négy metrikát.
- Létrejön az `eval/results.json` a fenti mezőkkel.
- A 4 megválaszolhatatlan kérdésre a helyes elutasítás 100% (4/4), mert 4 tételnél a 90%-os cél csak így teljesül.

**Tesztelés**
- `npm run eval` futtatása; egy tétel kézi ellenőrzése a `console.table` sora és a UI-on ugyanarra a kérdésre kapott válasz összevetésével.
- Ha a helyes elutasítás 100% alatt van vagy a válaszadási arány alacsony, a `RERANK_THRESHOLD` hangolása (pl. 6 → 7 vagy 6 → 5), majd újrafuttatás. A végleges érték a `.env.local`-ba és a Vercel env változói közé kerül.

**Függőségek és kockázatok**
- Függőség: 13. feladat; bemenet: `data/golden-set.json`.
- Kockázat: egy futás 15 kérdés × 10–25 másodperc, vagyis kb. 3–6 perc. Ezért a sorrendben a hangolásra legfeljebb két futás jut.
- Kockázat: 15 kérdés kis minta; egy-egy tétel 6–7 százalékpontot mozdít a metrikán. Ezt a bemutatón érdemes kimondani.

### 21. Publikus GitHub repó és Vercel deploy

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | Publikus GitHub repó és Vercel deploy | GitHub `kb-assistant` repó, Vercel projekt | Nincs deploy | Online, linkkel bemutatható | 🔴 blokkoló | S |

**Jelenlegi állapot**
Nincs repó és nincs deploy. A dokumentáció demóterve lokális futtatást feltételez; a döntés: publikus GitHub repó és Vercel.

**Probléma**
- Publikus repóban egy véletlenül commitolt kulcs perceken belül visszaélést okozhat.
- Ha a Vercel függvény régiója messze van a frankfurti Supabase-től, minden adatbázis-lekérdezés plusz késleltetést kap.

**Megoldás**
1. Titokellenőrzés push előtt:
   - `git ls-files | grep -i "\.env"` → csak `.env.example`;
   - `git grep -n "sk-"` → üres kimenet.
2. Repó létrehozása a GitHub webes felületén `kb-assistant` néven, publikusként, majd `git remote add origin …` és `git push -u origin main`.
3. `vercel.json` a repó gyökerében: `{ "regions": ["fra1"] }` – a függvények Frankfurtban futnak, a Supabase mellett.
4. Vercelen „Add New Project” → a `kb-assistant` repó importja, Framework: Next.js.
5. Env változók a Production és a Preview környezetre: `OPENAI_API_KEY`, `DATABASE_URL` (6543-as transaction pooler), `GENERATION_MODEL`, `HELPER_MODEL`, `EMBEDDING_MODEL`, `RERANK_THRESHOLD` (a 20. feladatban hangolt érték), `DEMO_USER`, `DEMO_PASSWORD`. A `DATABASE_URL_SESSION` Vercelre nem kell.
6. Deploy. Az első sikeres deploy után a projekt Production domainje (Vercel projekt › Settings › Domains) `DEMO_URL` néven, `https://` előtaggal a `.env.local`-ba kerül; a tesztparancsok ezt használják.
7. Az ingest nem fut Vercelen: a lokálisan feltöltött Supabase adatbázist használja az éles példány is.

**Elfogadási feltételek**
- A repó publikus, és nem tartalmaz titkot (az 1. lépés ellenőrzései üresek).
- Az éles URL Basic Auth-ot kér, helyes jelszóval egy kérdésre forrásokkal ellátott válasz érkezik.
- A Vercel projekt beállításaiban a függvényrégió `fra1`.
- A Vercel függvénynaplóban a próbakérdés alatt nincs hiba.

**Tesztelés**
- A 23. feladat szcenárióinak első kérdése az éles URL-en.
- `curl -i "$DEMO_URL/api/banks"` (401) és `curl -i -u "$DEMO_USER:$DEMO_PASSWORD" "$DEMO_URL/api/banks"` (200), a változók betöltése után (`set -a; source .env.local; set +a`).

**Függőségek és kockázatok**
- Függőség: 1–18. feladat; a `RERANK_THRESHOLD` végleges értéke a 20. feladatból.
- Kockázat: ha a build azért bukik, mert az `env.ts` build közben hiányzó változót talál, a változókat a Vercel projektben a deploy előtt kell felvenni (ld. 1. feladat kockázatai).

### 22. README

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 22 | README | `README.md` | Nincs | A publikus repó első benyomása az interjúztatónak | 🟡 csiszolás | S |

**Jelenlegi állapot**
A `create-next-app` alapértelmezett README-je. A dokumentáció „Demó építési terv › Lépések” része README-t ír elő architektúra-ábrával.

**Probléma**
Az interjúztató valószínűleg megnyitja a repót. Az alap README azt sugallja, hogy a projekt félkész, és a döntések indoklása (miért LLM rerank, miért a validátor) sehol nem látszik.

**Megoldás**
`README.md` szakaszai:
1. **Mi ez:** egy bekezdés – RAG-alapú belső tudásbázis asszisztens Bankmonitor hitelszakértők számára, demó.
2. **Architektúra:** Mermaid diagram (a GitHub megjeleníti) a query pipeline-ról: rewrite → embedding → hybrid search → RRF → LLM rerank + küszöb → generálás → validálás → válasz vagy „nincs forrás”.
3. **Pontossági rétegek:** a küszöb, a structured output, az idézet-validátor és az újrapróba röviden.
4. **Döntések és kompromisszumok:** a „Rögzített döntések” táblázat lényege, köztük a temperature és a `streamObject` kérdése.
5. **Mi maradt ki, és élesben hogyan lenne:** szám-ellenőrzés, verziókezelés, kamatok a termékadatbázisból tool callinggel, SSO, Langfuse, LLM-as-judge.
6. **Eval eredmények:** a négy metrika az `eval/results.json` legutóbbi futásából, a futás dátumával.
7. **Futtatás lokálisan:** `.env.local` kitöltése a `.env.example` alapján, `npm install`, `npm run db:migrate`, `npm run ingest`, `npm run dev`, `npm test`, `npm run eval`.
8. **Tudásanyag:** a Bankmonitor nyilvános cikkeiből, saját szavakkal összefoglalva; minden dokumentum front matterje tartalmazza a forrás-URL-t.

A demó URL-je szerepelhet, a jelszó nem.

**Elfogadási feltételek**
- A README nem tartalmaz jelszót és API kulcsot.
- A Mermaid diagram a GitHubon megjelenik.
- Az eval számok egyeznek az `eval/results.json` tartalmával.

**Tesztelés**
- A README megnyitása a GitHubon a push után.
- A lokális futtatás lépéseinek átolvasása a `package.json` scriptjeivel összevetve.

**Függőségek és kockázatok**
- Függőség: 20. feladat (eval eredmények), 21. feladat (repó).
- Kockázat: időhiánynál ez az első, ami rövidíthető: az 1., 2., 6. és 7. szakasz kötelező, a többi egy-egy mondatra szűkíthető.

### 23. Főpróba a bemutató szcenárióival

| # | Feladat | Hol (fájl/modul) | Probléma | Miért fontos | Súly | Méret |
| --- | --- | --- | --- | --- | --- | --- |
| 23 | Főpróba a bemutató szcenárióival | Éles Vercel URL | A dokumentáció 6 szcenáriójából a verziókezelési kimarad, a többit élesben még senki nem futtatta | A bemutatón derülne ki, ha valami nem működik | 🟠 komoly | S |

**Jelenlegi állapot**
A dokumentáció „Demó építési terv › Bemutatandó szcenáriók” része 6 szcenáriót ír le. Az 5. (verziókezelés) kimarad, mert a funkció nincs a scope-ban. A follow-up és a bankszűrő bekerült a demóba, ezért két új szcenárió kerül mellé.

**Probléma**
Az élő bemutatón minden hiba felnagyítódik. Egy szünetelő Supabase projekt, egy lassú első kérés (cold start) vagy egy rossz küszöb miatt elutasított alapkérdés az egész bemutatót viszi.

**Megoldás**
1. Előkészítés: a Supabase dashboardon ellenőrizni, hogy a projekt aktív (nem „Paused”), majd egy bemelegítő kérdés az éles URL-en a cold start kiváltására.
2. Szcenáriók az éles URL-en, sorrendben:
   1. **Alap kérdés hivatkozással:** „Mennyi a személyi kölcsön maximális futamideje?” személyi kölcsön szűrővel → válasz `[n]` jelölővel, forráskártya kiemelt idézettel.
   2. **Follow-up:** ugyanabban a beszélgetésben „És mekkora a minimális hitelösszeg?” → megjelenik a „Keresett kérdés” sor, a válasz a személyi kölcsönre vonatkozik.
   3. **A szűrő számít:** „Új beszélgetés”, majd „Mennyi a maximális futamidő?” lakáshitel szűrővel, utána ugyanez személyi kölcsön szűrővel → eltérő válasz és eltérő forrás.
   4. **Bankszűrő:** a golden set `bank` mezővel rendelkező tételének kérdése, a megfelelő bankszűrővel → csak az adott bank és az általános dokumentumok forrásai jelennek meg.
   5. **Nincs forrás:** „Milyen kriptobefektetést ajánl a bank?” → `not_found`, „Nincs elég releváns forrás a tudásbázisban”.
   6. **Hamis előfeltevés:** „Ugye a számlavezetés mindig ingyenes?” → a válasz a forrás alapján javítja az előfeltevést, hivatkozással.
   7. **Eval eredmény:** az `eval/results.json` eredményei a README-ben, szükség esetén `npm run eval` élőben.
3. Minden szcenárió válaszidejének feljegyzése.
4. Tartalék: egy sikeres végigfutás képernyőfelvétele, és a lokális `npm run dev` indítható állapotban, arra az esetre, ha a bemutatón nincs megbízható hálózat.

**Elfogadási feltételek**
- Mind a 7 szcenárió a leírt módon viselkedik az éles URL-en.
- Egyetlen válasz sem tart tovább 25 másodpercnél (a bemelegítő kérdés kivételével).
- A képernyőfelvétel elkészült, és a lokális indítás működik.

**Tesztelés**
- Maga a feladat a teszt: a 7 szcenárió végigjátszása az éles URL-en, egy privát böngészőablakban (tiszta Basic Auth állapottal).

**Függőségek és kockázatok**
- Függőség: 21. feladat (éles deploy), 20. feladat (eval eredmények), 22. feladat (README).
- Kockázat: ha egy szcenárió hibásan viselkedik, a javításra a 12 órás keretben nincs külön idő. Ezért a sorrend (3. szakasz) a főpróba előtt 15 perc tartalékot hagy, és a sikertelen szcenárió kihagyható a bemutatóból.

## 3. Javasolt sorrend

A teljes keret 12 óra. A csomagok egymásra épülnek; a csomagon belül a feladatok sorszám szerint haladnak.

| Csomag | Tartalom | Feladatok | Becsült idő | Kumulált idő |
| --- | --- | --- | --- | --- |
| 1. Alapok | Projekt váz, Supabase, séma és migráció | 1, 2, 3 | 1 óra 15 perc | 1 óra 15 perc |
| 2. Ingestion | Betöltő, chunking, embedding és mentés | 4, 5, 6 | 1 óra 30 perc | 2 óra 45 perc |
| 3. Retrieval | Hybrid search, RRF, LLM rerank és küszöb, query rewrite | 7, 8, 9, 10 | 2 óra 15 perc | 5 óra |
| 4. Generálás és pipeline | Prompt és séma, validátor és újrapróba, közös pipeline | 11, 12, 13 | 2 óra | 7 óra |
| 5. API és védelem | Streaming chat végpont, banklista végpont, Basic Auth | 14, 15, 18 | 45 perc | 7 óra 45 perc |
| 6. Felület | Chat felület szűrőkkel, válasz és forráskártyák | 16, 17 | 1 óra 45 perc | 9 óra 30 perc |
| 7. Minőség | Unit tesztek, eval és küszöbhangolás | 19, 20 | 1 óra | 10 óra 30 perc |
| 8. Deploy és bemutató | Vercel deploy, README, főpróba | 21, 22, 23 | 1 óra 15 perc | 11 óra 45 perc |
| Tartalék | Hibajavítás a főpróba előtt | – | 15 perc | 12 óra |

**Ha csúszik az idő**, ebben a sorrendben szűkíthető a scope:

| Lépés | Szűkítés | Megtakarítás |
| --- | --- | --- |
| 1 | 19. feladat: csak a `tests/validate.test.ts` marad | kb. 20 perc |
| 2 | 22. feladat: README csak a kötelező szakaszokkal (Mi ez, Architektúra, Eval eredmények, Futtatás) | kb. 15 perc |
| 3 | 15. feladat és a bankszűrő a `FilterBar`-ból elhagyva; a 23. feladat 4. szcenáriója kimarad | kb. 25 perc |
| 4 | 10. feladat elhagyva (follow-up nélkül); a 23. feladat 2. szcenáriója kimarad | kb. 30 perc |

Nem hagyható el semmilyen esetben: 9. (küszöb), 12. (validátor), 13. (pipeline), 17. (forráskártyák), 18. (Basic Auth) és 21. (deploy). Ezek nélkül a demó vagy nem bizonyítja a pontosságot, vagy nem biztonságosan publikus.
