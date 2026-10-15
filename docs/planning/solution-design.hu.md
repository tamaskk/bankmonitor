# AI tudásbázis chatbot – Dokumentáció és fejlesztési terv

Oct 15, 2026 · @tamas

## Vezetői összefoglaló

A Bankmonitor hitelszakértőinek szóló kérés egy belső, RAG-alapú (Retrieval-Augmented Generation) asszisztens: a szakértő kérdez, a rendszer kikeresi a tudásbázis releváns részeit, és csak azokból fogalmaz választ, forráshivatkozással. A legfontosabb elvárás a pontosság, ezért minden tervezési döntés ebből indul: a rendszer inkább azt mondja, hogy „nem találtam erre forrást”, mint hogy kitaláljon valamit.

- **Megoldás:** RAG pipeline termék szerinti metaadat-szűréssel, hybrid search-csel (kulcsszavas + szemantikus), rerankinggel és szerveroldali hivatkozás-ellenőrzéssel.
- **Forrás:** minden állítás mellett a dokumentum neve, fejezete, verziója és a szó szerint idézett szövegrész.
- **Pontosság mérése:** szakértőkkel összeállított tesztkérdés-sor (golden set), amin minden változtatás előtt lefut az automatikus kiértékelés.
- **Ütemezés:** PoC kb. 3–5 hét, éles indulás kb. 3–4 hónap egy 2 fős fejlesztőcsapattal. Pontos dátum a discovery fázis után adható.
- **Stack:** Next.js + NestJS (TypeScript), PostgreSQL + pgvector, cserélhető LLM-szolgáltató EU-s régióban.

**Elvárás-kezelés:** 100%-os pontosságot LLM-alapú rendszer nem tud garantálni. Amit garantálni tudunk: minden válasz ellenőrizhető forráson alapul, a forrás mindig látszik, és bizonytalanság esetén a rendszer nem válaszol.

## Az üzleti kérés elemzése

A rövid üzenetben hat elvárás van, ebből a pontosság a legkritikusabb. Mindegyik konkrét technikai követelményre fordítható le.

| Az üzlet mondata | Mit jelent technikailag |
| --- | --- |
| „AI-alapú chatbot, amitől a szakértők kérdezni tudnak” | Belső chat UI SSO-val; RAG, nem általános chatbot |
| „azonnal választ kapnak a tudásanyagainkból” | Ingestion pipeline a meglévő dokumentumokra; streaming válasz pár másodperc alatt |
| „termékenként szűrni is lehetne” | Termék metaadat minden chunkon, pre-filter a keresésben, szűrő a UI-on |
| „mindig pontosak… hibás információ nem mehet ki” | Grounding, elutasítás forrás hiányában, idézet-ellenőrzés, kiértékelés, verziókezelés |
| „látszódjon, melyik anyag alapján válaszolt” | Bekezdés szintű citation, kattintható forrás, kiemelt idézet |
| „Mikor tudnátok ezt megcsinálni?” | Fázisolt becslés feltételekkel; fix dátum csak discovery után |

### Tisztázó kérdések az üzlet felé

Egy jó fejlesztő először kérdez. Ezeket az interjún is érdemes elmondani, mert mutatja, hogy a kockázatokat látod.

**Tudásanyag**

- Milyen formátumban vannak az anyagok (PDF, Word, Confluence, SharePoint, intranet)? Hány dokumentum, hány oldal összesen?
- Milyen gyakran változnak? Ki a dokumentumgazda, és van-e jóváhagyási folyamat?
- Vannak-e régi, már nem hatályos verziók a tudásbázisban? Jelölve van a hatályosság?
- Vannak-e kondíciós listák, táblázatok (kamatok, díjak, THM)? Ezek a legkényesebbek.

**Felhasználók és használat**

- Hány szakértő használná, és hol: fiókban, telefonos ügyfélszolgálaton, back office-ban?
- Hol használnák: külön webes felületen, vagy Teamsben / a meglévő tudásbázisban beágyazva?
- Mennyire fontos a beszélgetés folytatása (follow-up kérdések), vagy elég az egyszeri kérdés-válasz?

**Pontosság és felelősség**

- Mi számít hibának? Elfogadható-e, hogy a rendszer néha azt mondja: „nem tudom”?
- Ki validálja a teszt-kérdéssort és a válaszokat termékenként?
- Elég a dokumentum szintű forrás, vagy bekezdés / oldal szintű kell?

**Biztonság és jogi keretek**

- Beírhatnak-e a szakértők ügyféladatot a kérdésbe? (Banktitok, GDPR.)
- Engedélyezett-e nyilvános felhős LLM EU-s régióban, vagy csak on-prem modell jöhet szóba?
- Van-e dokumentum szintű jogosultság (nem mindenki láthat mindent)?

**Siker és keretek**

- Mi a siker mérőszáma: kevesebb eszkaláció, gyorsabb ügyintézés, kevesebb hibás tájékoztatás?
- Mi az üzleti határidő oka (kampány, új termék, audit)? Mekkora a költségkeret?
- Bővül-e a termékkör a háromhoz képest?

## Feltételezések és Bankmonitor-specifikus szempontok

A megrendelő a Bankmonitor, amely független hitelközvetítő: a hitelszakértői 13 bank több mint 100 hiteltermékéből segítenek választani ([forrás](https://bankmonitor.hu/mediatar/cikk/olcsobb-hitel-rugalmasabb-feltetelek-miben-segithet-egy-szakerto/)). Ez a tervet két ponton módosítja: a szűrés bank szerint is kell, és a gyorsan változó számadatok nem dokumentumokból jönnek.

### A terv feltételezései

| Kérdés | Feltételezés a tervben és a demóban |
| --- | --- |
| Tudásanyag | Még nincs összegyűjtve; a demóhoz a Bankmonitor nyilvános cikkeiből készül, saját szavakkal, forráslinkkel |
| Formátum | Markdown (demó); élesben PDF, DOCX és wiki is |
| Hatályosság | Jelölve, verziózva; a demóban a cikkek frissítési dátuma alapján |
| Ügyféladat a kérdésben | Tilos; PII-detektálás figyelmeztet |
| LLM helye | EU-s felhő, zero data retention |
| Felület | Külön webapp |
| Beszélgetés | Follow-up kérdések is (query rewrite) |
| „Nem találtam forrást” | Elfogadható, sőt elvárt bizonytalanság esetén |
| Forrás részletessége | Idézet szint, link az eredeti oldalra |
| Demó határidő | 1–3 nap; szűkített scope |

### Mit jelent, hogy a megrendelő hitelközvetítő?

- **Több bank termékei:** a termék mellé bank szerinti szűrés is kell (pl. „OTP lakáshitel előtörlesztési díja”). A chunkok metaadata: termék, bank, téma.
- **Gyorsan változó kondíciók:** a kamatok, THM-ek, díjak gyakran változnak. Ezeket a Bankmonitor saját termékadatbázisából (a kalkulátorok adatforrásából) érdemes lekérni tool callinggel, nem dokumentumból. A RAG a szabályokra, folyamatokra és fogalmakra szól (pl. igénylés menete, jövedelemigazolás, CSOK Plusz feltételei).
- **Dátum minden számnál:** minden számadat mellett látszik, mikori. Egy kamat tegnapi értéke is hibás információ, ha ma már más.
- **Függetlenség:** a modell nem ajánlhat bankot vagy terméket; tényeket mutat, a döntés és a tanács a szakértőé.
- **Szabályozás:** hitelközvetítőként MNB-felügyelet és fogyasztóvédelmi elvárások vonatkoznak rá; a DORA és az MNB felhőajánlás alkalmazhatóságát a compliance területtel kell egyeztetni.

## Követelmények

Az MVP a kérés öt funkcióját fedi le; minden más későbbi fázisba kerül. A nem-funkcionális célszámok javaslatok, ezeket az üzlettel kell egyeztetni.

### Funkcionális

**Must have (MVP)**

1. Kérdés feltevése magyarul, természetes nyelven, streaming válasszal.
2. Termékszűrő: lakáshitel, személyi kölcsön, bankszámla, vagy összes.
3. Válasz kizárólag a tudásbázisból; forrás hiányában egyértelmű elutasítás.
4. Forráshivatkozás minden állításnál: dokumentum, fejezet, oldal, verzió, idézett szövegrész, link az eredetire.
5. Visszajelzés minden válaszra (hasznos / hibás + indoklás).
6. Admin felület: dokumentum feltöltése, termékhez rendelése, hatályosság beállítása, újraindexelés.

**Should have**

- Follow-up kérdések egy beszélgetésen belül.
- SSO (pl. Microsoft Entra ID) és szerepkörök (szakértő, admin, dokumentumgazda).
- Kiértékelési dashboard: minőség, használat, hibajelzések termékenként.

**Could have / később**

- Beágyazás Teamsbe vagy a meglévő tudásbázis felületébe.
- Automatikus szinkron a forrásrendszerből (SharePoint / Confluence).
- Termék automatikus felismerése a kérdésből, szűrő javaslattal.

### Nem-funkcionális

| Szempont | Javasolt cél |
| --- | --- |
| Válaszidő | Első token < 2 s, teljes válasz < 8 s |
| Pontosság (golden set) | Faithfulness ≥ 95%, hivatkozás-pontosság ≥ 98% |
| Helyes elutasítás | Megválaszolhatatlan kérdések ≥ 90%-ánál „nincs forrás” válasz |
| Biztonság | SSO, RBAC, titkosítás, adat EU-s régióban |
| Auditálhatóság | Minden kérdés, válasz, felhasznált forrás és modellverzió naplózva |
| Rendelkezésre állás | 99,5% munkaidőben |
| Nyelv | Magyar kérdések és válaszok, magyar dokumentumok |

## Architektúra

A rendszer két pipeline-ból áll: az ingestion előre feldolgozza a dokumentumokat, a query pipeline pedig kérdésenként keres, generál és ellenőriz. A kettőt egy PostgreSQL adatbázis köti össze.

&#91;embedded content: architektúra · ingestion és query pipeline, két ellenőrzési ponttal\]

A relevancia-küszöb és a validálás két ponton is megállíthatja a választ; ilyenkor a szakértő a „nincs megbízható forrás” üzenetet kapja, nem egy kitalált választ.

### Ingestion pipeline (dokumentum → kereshető tudás)

1. **Feltöltés / szinkron:** admin feltölti a dokumentumot, megadja a terméke(ke)t és a hatályosságot (valid\_from, valid\_to).
2. **Parsing:** PDF / DOCX szövegre bontása, a struktúra (fejezetek, táblázatok, oldalszámok) megőrzésével.
3. **Chunking:** struktúra-alapú darabolás fejezetek mentén, kb. 400–800 token, kis átfedéssel. A táblázatok egyben maradnak.
4. **Kontextus fejléc:** minden chunk elé kerül a dokumentum címe, a termék és a fejezet útvonala. Így egy „Futamidő” bekezdés is tudja, melyik termékhez tartozik.
5. **Embedding + full-text index:** vektor a szemantikus kereséshez, tsvector a kulcsszavashoz (magyar stemmerrel).
6. **Verziókezelés:** új verzió feltöltésekor a régi chunkjai inaktívvá válnak, de az audit miatt megmaradnak.

A feldolgozás háttérben fut (BullMQ job queue), így egy nagy dokumentum sem blokkolja a felületet.

### Query pipeline (kérdés → ellenőrzött válasz)

1. **Bemenet:** kérdés + opcionális termékszűrő + beszélgetés-előzmény.
2. **Query rewrite:** follow-up kérdésnél önálló kérdéssé alakítás („És mennyi a futamidő?” → „Mennyi a személyi kölcsön futamideje?”).
3. **Hybrid search:** vektoros + kulcsszavas keresés, csak aktív, hatályos, a szűrőnek megfelelő chunkokon; top 20 találat, Reciprocal Rank Fusion összefésüléssel.
4. **Reranking:** cross-encoder reranker sorrendezi a 20 találatot, a legjobb 5–6 megy tovább.
5. **Relevancia-küszöb:** ha a legjobb találat pontszáma a küszöb alatt van, az LLM meg sem hívódik; a válasz: „nem találtam erre forrást”.
6. **Generálás:** LLM a számozott forrásokból, szigorú system prompttal, strukturált (JSON) kimenettel.
7. **Validálás:** szerveroldali ellenőrzés, hogy minden hivatkozás és idézet tényleg szerepel a forrásokban.
8. **Válasz + források:** a UI megjeleníti a választ, a hivatkozásokat és a forráskártyákat.
9. **Naplózás + visszajelzés:** minden lépés trace-elve (melyik chunk, milyen pontszám, melyik modell).

## Pontosság és megbízhatóság

A „hibás információ nem mehet ki” elvárást nem egy trükk, hanem egymásra épülő védelmi rétegek teljesítik. Ha az egyik réteg hibázik, a következő megfogja.

1. **Forrásminőség:** csak jóváhagyott, hatályos dokumentum kerül be. Lejárt verzió automatikusan kikerül a keresésből. A hibák nagy része nem az LLM-ből, hanem elavult vagy ellentmondó anyagból jön.
2. **Jó keresés:** struktúra-alapú chunking, kontextus fejléc, termékszűrő. Hybrid search kell, mert a pontos kifejezéseket (THM, „Babaváró”, egy díj neve, egy összeg) a vektoros keresés gyakran elvéti.
3. **Reranking + küszöb:** gyenge találatnál nincs generálás. Inkább „nem tudom”, mint egy félig releváns forrásból összerakott válasz.
4. **Szigorú prompt:** csak a megadott forrásokból; minden állítás után hivatkozás; számok, kamatok, díjak szó szerint; ellentmondó források esetén mindkettőt jelezze. Temperature 0.
5. **Strukturált kimenet:** JSON séma: status (answered / not\_found / partial), answer, citations \[{sourceId, quote}\].
6. **Determinisztikus validálás a szerveren:**
   - minden sourceId létezik a modellnek átadott forrásokban;
   - minden quote szó szerint (normalizálva) megtalálható a hivatkozott chunk szövegében;
   - minden szám a válaszban (kamat, összeg, futamidő) szerepel valamelyik hivatkozott forrásban. Ha valami nem stimmel: egy újragenerálás, utána elutasítás. Ez kódból ellenőrzött garancia, nem a modell jóindulatán múlik.
7. **Groundedness check (opcionális):** egy második, olcsóbb LLM-hívás ellenőrzi, hogy a válasz minden állítását alátámasztják-e a források.
8. **UI:** a forrás mindig látszik, kiemelt idézettel. Rövid figyelmeztetés: AI által generált válasz, ügyfél-tájékoztatás előtt ellenőrizd a forrást.
9. **Folyamat:** a „hibás” visszajelzés a dokumentumgazdához megy; minden javított hiba új tesztesetként bekerül a golden setbe.

### Példa system prompt (rövidítve)

```text
Te a Bankmonitor hitelszakértőinek belső tudásbázis-asszisztense vagy.
SZABÁLYOK:
1. Kizárólag a <források> között megadott szövegekből válaszolj.
2. Minden állítás után jelöld a forrást: [1], [2].
3. Számokat, kamatokat, díjakat, határidőket szó szerint vegyél át.
4. Ha a források nem tartalmazzák a választ, status = not_found.
5. Ha a források ellentmondanak egymásnak, mutasd be mindkettőt.
6. Ne használj általános tudást, ne becsülj, ne általánosíts.
7. Ne ajánlj konkrét bankot vagy terméket; a döntés a szakértőé.
Válaszolj magyarul, tömören, a megadott JSON sémában.
```

## Forráshivatkozás és termékszűrés

Mindkét funkció a chunkok metaadataira épül: a termék a keresést szűri, a forrásadatok a hivatkozást jelenítik meg.

### Termékszűrés

- Minden dokumentum egy vagy több termékhez tartozik: `lakashitel`, `szemelyi_kolcson`, `bankszamla`, vagy `altalanos` (pl. általános szerződési feltételek, panaszkezelés).
- A termék a chunkokra is rákerül, így a szűrés a keresés előtt történik (pre-filter), nem utólag. Ez gyorsabb és pontosabb: a modell nem is látja a más termékhez tartozó szöveget.
- Kiválasztott terméknél a keresés a termék + `altalanos` chunkjain fut. „Összes” módban minden forráskártyán látszik a termék címkéje.
- Ez a funkció a pontosságot is védi: „Mennyi a maximális futamidő?” kérdésre lakáshitelnél és személyi kölcsönnél más a helyes válasz.

**Bank szerinti szűrés:** mivel a tudásanyag több bank termékeiről szól, a termékszűrő mellé opcionális bankszűrő kerül (`banks text[]` a chunkokon, ugyanúgy pre-filterként). Ha a kérdés bankot említ, de nincs kiválasztva szűrő, a UI felajánlja.

```sql
WHERE c.is_active
  AND c.products && ARRAY['szemelyi_kolcson', 'altalanos']
  AND (d.valid_to IS NULL OR d.valid_to >= now())
```

### Forráshivatkozás

- A válaszban inline jelölők: „A maximális futamidő 8 év \[1\].”
- A jelölőre kattintva vagy a válasz alatt forráskártya: dokumentum címe, fejezet útvonala, oldalszám, verzió, hatályosság kezdete, termék címke.
- A kártyán a modell által idézett szövegrész kiemelve, körülötte a chunk szövege.
- Link az eredeti dokumentumra a megfelelő oldalra ugorva (PDF esetén `#page=12`).
- A hivatkozás két szintű: chunk szintű (honnan jön) és idézet szintű (pontosan melyik mondat). Az idézet-szint teszi gyorsan ellenőrizhetővé a választ a szakértőnek.

## Tech stack javaslat

Végig TypeScript, egyetlen PostgreSQL adatbázissal és cserélhető LLM-szolgáltatóval. A demó ugyanezt a stacket használja egyszerűsítve, így a bemutatott kód nem eldobható.

| Réteg | Éles javaslat | Demó | Miért |
| --- | --- | --- | --- |
| Frontend | Next.js (App Router), Tailwind, shadcn/ui | Ugyanez | Gyors fejlesztés, streaming UI |
| Backend | NestJS (modulok: ingestion, retrieval, chat, eval, admin) | Next.js route handlerek | Rétegzett, tesztelhető; demóhoz elég egy app |
| LLM integráció | Vercel AI SDK | Ugyanez | Provider-független, streaming, zod-sémás structured output |
| LLM | Claude vagy GPT-osztályú modell EU-s régióban (AWS Bedrock, Azure OpenAI, Vertex AI) | Közvetlen API | Adatrezidencia, szolgáltató cserélhető |
| Embedding | Multilingual modell, pl. text-embedding-3-large vagy on-prem bge-m3 | text-embedding-3-small/large | Jó magyar nyelvi teljesítmény kell |
| Reranker | Multilingual reranker, pl. Cohere Rerank vagy bge-reranker-v2-m3 | Cohere Rerank vagy LLM-alapú | Nagy pontosság-nyereség kis költségért |
| Adatbázis | PostgreSQL + pgvector + full-text (hungarian) | Docker Compose | Egy DB: vektor, kulcsszó, metaadat, jogosultság, audit |
| Parsing | Docling vagy unstructured (Python worker) | pdf-parse + mammoth | Táblázatok és struktúra megőrzése |
| Job queue | BullMQ + Redis | Szinkron script | Háttérben futó ingestion, újrapróbálás |
| Auth | Microsoft Entra ID SSO (Auth.js) | Nincs | Vállalati szabvány |
| Observability | Langfuse (self-hosted) | Langfuse cloud vagy konzol log | Trace minden lépésről, költség, latencia |
| Kiértékelés | promptfoo vagy Ragas + saját script, CI-ban | Saját eval script | Regressziós védelem |

### Miért pgvector és nem külön vektor-adatbázis?

- A szűrés, a jogosultság és a hatályosság sima SQL `WHERE`; nincs két rendszer közti szinkron.
- Ugyanabban a táblában a vektoros és a kulcsszavas index, így a hybrid search egy lekérdezés.
- A Postgres beépített `hungarian` full-text konfigurációja magyar szótövezést ad.
- A bankok jellemzően már üzemeltetnek Postgrest, így könnyebb átmenni a biztonsági jóváhagyáson.
- Néhány százezer chunkig bőven elég; dedikált vektor DB csak akkor kell, ha ez szűk keresztmetszet lesz.

### Build vs. buy

Érdemes megemlíteni, hogy léteznek kész megoldások (pl. Microsoft Copilot Studio, Azure AI Search „on your data”). Gyorsabb indulást adnak, de kevesebb kontrollt a hivatkozás-validálás, a hatályosság-kezelés és a kiértékelés felett. Ahol a pontosság a fő követelmény, ez a kontroll indokolja az egyedi fejlesztést.

## Adatmodell és API

Öt fő tábla elég: dokumentumok, chunkok, beszélgetések, üzenetek és visszajelzések. A chunk táblában van a vektor, a full-text index és minden szűréshez szükséges metaadat.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  products    text[] NOT NULL,          -- lakashitel, szemelyi_kolcson, bankszamla, altalanos
  version     text NOT NULL,
  valid_from  date NOT NULL,
  valid_to    date,                     -- NULL = hatályos
  source_url  text,
  owner       text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid REFERENCES documents(id),
  content       text NOT NULL,
  section_path  text,                   -- pl. 'Kondíciók > Futamidő'
  page          int,
  products      text[] NOT NULL,
  is_active     boolean DEFAULT true,
  embedding     vector(1536),
  tsv           tsvector GENERATED ALWAYS AS (to_tsvector('hungarian', content)) STORED
);

CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON chunks USING gin (tsv);
CREATE INDEX ON chunks USING gin (products);
```

A `messages` tábla az asszisztens válaszainál eltárolja a felhasznált chunk ID-kat, a pontszámokat, a modell nevét és a prompt verzióját. Így minden válasz utólag visszakövethető, ami auditnál kulcsfontosságú.

| Végpont | Leírás |
| --- | --- |
| `POST /api/chat` | Kérdés + `product?` + `conversationId?`; streaming (SSE) válasz, a végén források és státusz |
| `POST /api/feedback` | `messageId`, `rating` (helpful / wrong), `comment` |
| `GET /api/documents` | Dokumentumlista szűrőkkel (admin) |
| `POST /api/documents` | Feltöltés metaadatokkal; ingestion job indul (admin) |
| `PATCH /api/documents/:id` | Hatályosság, termék, státusz módosítása; újraindexelés (admin) |
| `GET /api/admin/metrics` | Használat, visszajelzések, eval eredmények termékenként |

## Biztonság, adatvédelem, compliance

Pénzügyi szolgáltatónál ez gyakran hosszabb, mint maga a fejlesztés, ezért a biztonsági és compliance csapatot már a discovery fázisba be kell vonni. Az alábbiak fejlesztői szemmel összeszedett szempontok, a végleges értelmezés a bank jogi és compliance területéé.

### Technikai védelem

- **Hozzáférés:** SSO (Entra ID), szerepkör-alapú jogosultság; ha kell, dokumentum szintű ACL, amit a keresés SQL-ben szűr.
- **Adatrezidencia:** LLM és embedding EU-s régióban, szerződésben rögzített zero data retention, a kérdések nem kerülnek modelltanításba.
- **Ügyféladat:** a tool belső tudásra szól, ügyféladat nem kell bele. PII-detektálás a bemeneten (név, adóazonosító, számlaszám), figyelmeztetés vagy maszkolás.
- **Audit log:** ki, mikor, mit kérdezett, mit kapott, melyik forrásból, melyik modellverzióval. Megőrzési idő a bank szabályzata szerint.
- **Titkosítás:** TLS átvitelkor, titkosított tárolás, secret-ek vault-ban.
- **Prompt injection:** a dokumentumok belsők, így kicsi a kockázat, de a forrásszöveget a prompt adatként jelöli, nem utasításként.

### Szabályozási szempontok

- **GDPR és banktitok:** adatminimalizálás, ügyféladat ne kerüljön a rendszerbe.
- **EU AI Act:** belső tudásbázis-asszisztensként várhatóan nem magas kockázatú, de átláthatósági kötelezettség van (a felhasználó tudja, hogy AI-val beszél). Hitelképesség-értékelésre nem használható, mert az magas kockázatú kategória.
- **DORA (ha alkalmazandó):** az LLM-szolgáltató ICT harmadik fél. Kell kockázatértékelés, szerződéses feltételek és kiléptetési stratégia. A provider-független architektúra ezt közvetlenül támogatja.
- **MNB felhőajánlás:** nyilvános felhő igénybevételénél az MNB vonatkozó ajánlása szerinti kockázatelemzés és bejelentés szükséges lehet.
- **Fallback:** ha felhő nem engedélyezett, a stack on-prem nyílt modellekkel (pl. bge-m3 embedding, saját hostolt LLM) is működik, gyengébb minőség mellett.

## Minőségbiztosítás: evaluation, tesztelés, monitoring

A pontosságot mérni kell, nem érezni: egy golden set nélkül egy prompt- vagy modellcsere csendben ronthat a válaszokon. Ezért a kiértékelés az MVP része, nem utólagos extra.

### Golden set

- Termékenként 30–50 kérdés, a szakértőkkel közösen összeállítva: kérdés, elvárt válasz, elvárt forrás(ok).
- Benne kell lennie megválaszolhatatlan kérdéseknek is (amire nincs forrás), mert ezeknél a helyes viselkedés az elutasítás.
- Trükkös esetek: hamis előfeltevés („Ugye a bankszámla vezetése ingyenes?”), termékek összekeverése, régi verzióra vonatkozó kérdés, számokat tartalmazó kérdések.
- Minden éles hibajelzésből új teszteset lesz.

### Metrikák

| Metrika | Mit mér | Hogyan |
| --- | --- | --- |
| Retrieval recall@k | Benne van-e az elvárt forrás a top k találatban | Automatikus, elvárt chunk ID alapján |
| Faithfulness | Minden állítást alátámaszt-e a forrás | LLM-as-judge + szúrópróba |
| Answer correctness | Egyezik-e az elvárt válasszal | LLM-as-judge + szakértői szúrópróba |
| Citation accuracy | A hivatkozott forrás tényleg tartalmazza-e az állítást | Automatikus idézet-egyezés |
| Helyes elutasítás | Megválaszolhatatlan kérdésnél not\_found-e a státusz | Automatikus |
| Latencia, költség / kérdés | Felhasználói élmény és üzemeltetés | Langfuse trace |

### Tesztelés és CI

- Unit tesztek: chunking, szűrés, idézet-validátor, számellenőrző.
- Integrációs teszt: teljes pipeline egy kis teszt-korpuszon.
- Eval a CI-ban: minden prompt-, modell- vagy chunking-változásnál lefut; ha a metrikák a küszöb alá esnek, nincs deploy.

### Éles monitoring

- Visszajelzési arány és a „hibás” jelzések termékenként, heti átnézéssel.
- Not\_found arány: ha magas, hiányzik tartalom a tudásbázisból. Ez hasznos jelzés a dokumentumgazdáknak is.
- Leggyakoribb kérdések és válasz nélküli kérdések listája.

## Fejlesztési terv és ütemezés

A javasolt út öt fázis, kapukkal közöttük: kb. 3–5 hét alatt mérhető PoC, kb. 3–4 hónap alatt éles rendszer. Minden kapunál az üzlet dönt a továbblépésről, így a kockázat korán kiderül.

&#91;embedded content: roadmap · 5 fázis, 3 kapu\]

A PoC egyetlen termékre már 3–5 hét után megmutatja, hogy a pontossági cél elérhető-e; a nagyobb befektetés (MVP) csak ezután indul.

### Fázisok részletesen

1. **Discovery (1–2 hét):** dokumentum-leltár (formátum, mennyiség, hatályosság), felhasználói interjúk, biztonsági és compliance követelmények, a golden set első 50 kérdése.
2. **PoC (2–3 hét):** egy termékre (javaslat: személyi kölcsön, mert ennek a legkisebb az anyaga). Ingestion, hybrid search, generálás hivatkozással, eval baseline. Kapu: a golden seten mért pontosság eléri a megbeszélt szintet.
3. **MVP (5–6 hét):** mindhárom termék, termékszűrő, idézet-validálás, admin felület, visszajelzés, SSO, audit log, eval a CI-ban. Kapu: biztonsági jóváhagyás + eval célszámok.
4. **Pilot (3–4 hét):** 10–20 szakértő éles anyagon. Heti hibajelzés-átnézés, prompt és chunking finomhangolás. Kapu: pilot felhasználók visszajelzése és a hibaarány.
5. **Éles indulás és üzemeltetés:** fokozatos kiterjesztés, monitoring, dokumentumgazdai folyamat, havi eval riport.

### Csapat

- 2 full-stack / AI fejlesztő (teljes idő).
- Product owner vagy BA (részidő).
- Termékenként 1 szakértő heti 2–4 órában: golden set, validálás, pilot.
- Security, compliance és infra kapcsolattartó (igény szerint).

### Mitől függ a dátum?

- Milyen állapotban vannak a dokumentumok (szkennelt PDF vagy strukturált Word, van-e hatályosság jelölve).
- Mennyi idő a biztonsági és compliance jóváhagyás, főleg felhős LLM esetén.
- Mennyire érnek rá a szakértők a golden setre és a pilotra.

### Javasolt válasz az üzletnek

> Sziasztok! Köszönjük, jó ötlet és jól megvalósítható. Mivel a pontosság a legfontosabb, olyan megoldást javaslunk, amely csak a tudásbázisból válaszol, minden állításnál megmutatja a forrást, és ha nem talál megbízható forrást, nem válaszol. Javasolt ütemezés: 1–2 hetes felmérés után kb. 2–3 hét alatt egy termékre (pl. személyi kölcsön) működő, mérhető prototípust mutatunk, éles indulás kb. 3–4 hónap múlva reális. A pontos dátumhoz pár kérdésünk lenne a dokumentumokról, a felhasználókról és a biztonsági keretekről. Mikor tudnánk egy 30 perces egyeztetést tartani?

## Kockázatok és kezelésük

A legnagyobb kockázat nem technikai, hanem a tudásanyag minősége: elavult vagy ellentmondó dokumentumból a legjobb modell is hibás választ ad.

| Kockázat | Hatás | Kezelés |
| --- | --- | --- |
| Elavult vagy ellentmondó dokumentumok | Magas | Hatályosság-kezelés, dokumentumgazdák, ellentmondás jelzése a válaszban |
| Hallucináció (forrásban nem szereplő állítás) | Magas | Küszöb, szigorú prompt, idézet- és számvalidálás, groundedness check |
| Rossz keresési találat (pl. másik termék) | Magas | Termékszűrő, hybrid search, reranking, recall mérés |
| Táblázatok, kondíciós listák rossz feldolgozása | Közepes | Táblázat-tudatos parsing, táblázat egy chunkban, külön tesztesetek |
| Túlzott bizalom: a szakértő nem nézi meg a forrást | Közepes | Kiemelt idézet a UI-on, figyelmeztetés, képzés a bevezetéskor |
| Biztonsági jóváhagyás elhúzódik | Közepes | Korai bevonás, EU-s régió, on-prem fallback opció |
| Szakértői kapacitás hiánya a golden sethez | Közepes | Kis kezdő set (termékenként 30), fokozatos bővítés éles hibajelzésekből |
| Szolgáltatói függés, árváltozás | Alacsony | Provider-független LLM réteg, eval-lel ellenőrzött modellcsere |
| Költség növekedése használattal | Alacsony | Token-limitek, cache gyakori kérdésekre, kisebb modell az egyszerű lépésekre |

## Demó építési terv

A demó célja nem egy kész termék, hanem annak bizonyítása, hogy a pontossági rétegek működnek: szűrés, hivatkozás, elutasítás, mérés. A határidő 1–3 nap, ezért a scope szűkített: ami nem a pontosságot bizonyítja, kimarad.

### Scope

- Next.js app (frontend + route handlerek), PostgreSQL + pgvector Docker Compose-ban.
- Tudásanyag: 12–15 markdown dokumentum a Bankmonitor nyilvános cikkeiből (lakáshitel, személyi kölcsön, bankszámla, általános: pl. THM, hitelközvetítés), saját szavakkal összefoglalva. Front matter: cím, termék(ek), bank(ok), forrás-URL, frissítés dátuma.
- Egy dokumentum két verzióban (régi és frissített feltétel), hogy a verziókezelés bemutatható legyen.
- Funkciók: termék- és bankszűrő, streaming, follow-up kérdések, inline hivatkozás, kiemelt idézet, not\_found állapot, visszajelzés gomb.
- Eval script 15 kérdéssel, köztük 4 megválaszolhatatlannal.
- Kimarad (csak szóban említed): admin UI, SSO, háttér-queue, Langfuse, kamatok lekérése a termékadatbázisból.

### Lépések

1. **1. nap délelőtt — váz és tudásanyag:** Next.js, Tailwind, shadcn/ui, Docker Compose, séma-migráció; a Bankmonitor alapú markdown dokumentumok elkészítése.
2. **1. nap délután — ingestion:** front matter beolvasás, fejezet-alapú chunking, kontextus fejléc, embedding, mentés metaadatokkal.
3. **2. nap délelőtt — retrieval:** vektoros + full-text lekérdezés, RRF, termék-, bank- és hatályosság-szűrő, rerank, küszöb.
4. **2. nap délután — generálás és validátor:** Vercel AI SDK, system prompt, zod séma, query rewrite a follow-uphoz; idézet- és számellenőrzés, újragenerálás, not\_found.
5. **3. nap délelőtt — UI:** chat, szűrők, hivatkozás-jelölők, forráskártyák kiemelt idézettel, not\_found állapot, visszajelzés.
6. **3. nap délután — eval és főpróba:** golden set, eval script (recall@5, citation accuracy, helyes elutasítás), README, a hat szcenárió végigpróbálása.

Ha szorul az idő, a reranker és a visszajelzés gomb hagyható el elsőként; a validátor és a not\_found állapot nem.

### Repo struktúra

```text
kb-assistant/
  docker-compose.yml
  data/docs/               # Bankmonitor alapú markdown tudásanyag
  data/golden-set.json     # eval kérdések
  db/schema.sql
  scripts/ingest.ts
  scripts/eval.ts
  src/app/page.tsx         # chat UI
  src/app/api/chat/route.ts
  src/lib/retrieval.ts     # hybrid search + rerank + küszöb
  src/lib/generate.ts      # prompt + structured output
  src/lib/validate.ts      # idézet- és számellenőrzés
  src/components/SourceCard.tsx
```

### Bemutatandó szcenáriók

1. **Alap kérdés hivatkozással:** „Mennyi a személyi kölcsön maximális futamideje?” → válasz \[1\] jelölővel, forráskártya kiemelt idézettel.
2. **A szűrő számít:** ugyanaz a kérdés lakáshitel szűrővel más választ és más forrást ad.
3. **Nincs forrás:** „Milyen kriptobefektetést ajánl a bank?” → not\_found, nincs kitalált válasz.
4. **Hamis előfeltevés:** „Ugye a számlavezetés mindig ingyenes?” → a forrás alapján javítja az előfeltevést.
5. **Verziókezelés:** a kamatkérdésre a hatályos verzióból válaszol, nem a régiből.
6. **Eval eredmény:** a script lefut, megmutatod a metrikákat. Ez mutatja, hogy a pontosságot mérni is tudod.

## Szóbeli bemutatás és várható kérdések

A bemutató vezérfonala egy mondat: „A kérés legfontosabb szava a pontosság, ezért minden döntésem abból indul ki.” Erre építve kb. 12–15 perc, utána kérdések.

### Forgatókönyv

1. **A kérés újrafogalmazása (1 perc):** mit kér az üzlet, és mi benne a kritikus elvárás.
2. **Kérdések, amiket feltennék (2 perc):** dokumentumok állapota, hatályosság, ügyféladat, felhő engedélyezett-e. Mutatja, hogy nem rohansz bele a kódolásba.
3. **Architektúra (2–3 perc):** a két pipeline, és hol vannak a pontossági rétegek.
4. **Élő demó (5 perc):** a hat szcenárió sorrendben. Ha valami elromlik, nyugodtan mondd ki, és magyarázd el, melyik réteg kezelné.
5. **Ütemezés (1–2 perc):** a fázisok és a válasz a „Mikor tudnátok?” kérdésre.
6. **Kockázatok és következő lépések (1 perc):** a fő kockázat a tudásanyag minősége.

### Várható kérdések és válaszok

**Miért RAG, és miért nem fine-tuning?** A fine-tuning stílust tanít, nem megbízható tudást, nem tud forrást mutatni, és minden dokumentumváltozásnál újra kellene tanítani. A RAG-nál a tudás a dokumentumokban marad, frissíthető és hivatkozható.

**Hogyan garantálod a pontosságot?** 100%-ot nem lehet garantálni, de rétegekben csökkentem a kockázatot: jó források, szűrt keresés, küszöb, szigorú prompt, kódból ellenőrzött idézetek és számok, mérés golden seten. Ami garantálható: minden válasz ellenőrizhető forrásra mutat, és bizonytalanságnál nincs válasz.

**Mi van, ha két dokumentum ellentmond egymásnak?** A prompt előírja, hogy mindkettőt mutassa be hivatkozással. A hibajelzés a dokumentumgazdához megy, mert ez tartalmi hiba, nem AI hiba.

**Hogyan kezeled az elavult dokumentumokat?** Hatályossági mezők (valid\_from, valid\_to), és új verzió feltöltésekor a régi chunkok inaktívvá válnak. A keresés csak hatályos tartalmat lát, a régi az audit miatt megmarad.

**Miért hybrid search?** A vektoros keresés jól kezeli a jelentést, de pontatlan konkrét kifejezéseknél: terméknevek, rövidítések (THM), összegek. A kulcsszavas keresés ezeket pontosan találja. A kettő együtt, RRF-fel összefésülve jobb recallt ad.

**Mi a reranker, és miért kell?** Egy cross-encoder modell, amely a kérdést és a chunkot együtt olvasva pontosabb relevancia-pontszámot ad, mint az embedding-hasonlóság. Lassabb, ezért csak a top 20 találatot rendezi. A pontszáma adja a küszöböt is.

**Milyen chunk méretet használsz, és miért?** Fejezet-alapú darabolás kb. 400–800 tokenre, kis átfedéssel, kontextus fejléccel. Túl kicsi chunkból hiányzik a kontextus, túl nagyban elvész a lényeg. A pontos értéket a golden seten mért recall alapján hangolnám.

**Hogyan kezeled a magyar nyelvet?** Multilingual embedding és reranker, a Postgres full-text keresésnél `hungarian` konfiguráció szótövezéssel. A golden set magyar, így a nyelvi minőség is mérve van.

**Hova kerülnek az adatok, mi a helyzet a banktitokkal?** EU-s régióban futó LLM, zero data retention szerződéssel; a tool belső tudásra szól, ügyféladat nem kell bele, és PII-detektálás figyelmeztet. Ha felhő nem engedélyezett, on-prem nyílt modellekkel is működik.

**Mennyibe kerül egy kérdés?** Kb. 5–6 chunk × 600 token + prompt ≈ 4–5 ezer input token és pár száz output token kérdésenként. Az aktuális modellárakkal ez jellemzően néhány cent vagy kevesebb. Cache-sel és kisebb modellel az egyszerű lépésekre tovább csökkenthető.

**Hogyan méred, hogy jól működik?** Golden set termékenként, metrikák: recall@k, faithfulness, citation accuracy, helyes elutasítás. CI-ban fut minden változásnál. Élesben visszajelzés, not\_found arány, hibajelzések heti átnézése.

**Miért nem egy kész megoldás, pl. Copilot?** Gyorsabb indulás, de kevesebb kontroll a hivatkozás-validálás, a hatályosság és a mérés felett. Opcióként érdemes megvizsgálni a discovery-ben; ahol a pontosság a fő követelmény, az egyedi pipeline indokolt.

**Hogyan skálázódik?** A query pipeline állapotmentes, horizontálisan skálázható. A pgvector HNSW indexe néhány százezer chunkig gond nélkül bírja. Az ingestion háttér-queue-ban fut, így a nagy feltöltések nem lassítják a chatet.

**Hogyan kezeled a táblázatokat?** Táblázat-tudatos parsing, a táblázat egy chunkban marad a fejlécével együtt. A kondíciós listákra külön tesztesetek vannak, mert ott a legnagyobb a hibás szám kockázata.

**Mit csinálnál másképp éles rendszerben, mint a demóban?** NestJS backend külön modulokkal, SSO, dokumentum-szintű jogosultság, háttér-queue az ingestionhöz, Langfuse trace, eval a CI-ban, admin felület a dokumentumgazdáknak.

**Miért nem a dokumentumokból jönnek a kamatok?** A kamatok és díjak gyakran változnak, egy dokumentum pedig gyorsan elavul. Élesben ezeket a Bankmonitor termékadatbázisából kérné le a modell tool callinggel, lekérdezési dátummal. A RAG a szabályokra, folyamatokra és fogalmakra való.

**Hogyan kezeled, hogy 13 bank termékei vannak a tudásbázisban?** A chunkokon termék és bank metaadat van, mindkettő pre-filterként szűrhető. „Összes” módban a forráskártyán látszik a bank neve, így nem keverednek össze a feltételek. A modell nem ajánl bankot, mert a független tanácsadás a szakértő feladata.
