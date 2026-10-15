// Fixed answers for messages about the assistant itself ("Mit tudok tőled
// kérdezni?") and for small talk. They are written here, not generated, so
// they cannot invent anything. Pure: no env, no model calls.
//
// The topic list mirrors data/docs/: update it when documents are added or removed.

export type Intent = "help" | "greeting" | "thanks" | "off_topic" | "question";

export const HELP_MESSAGE = `A Bankmonitor hitelszakértőinek belső tudásbázis-asszisztense vagyok. Kizárólag a tudásbázis dokumentumaiból válaszolok, minden állításhoz megmutatom a forrást és a szó szerinti idézetet. Ha nincs megbízható forrás, ezt jelzem, és nem találgatok.

Ezekről a témákról kérdezhetsz:
• Lakáshitel: maximális futamidő, önerő, igénylés menete, előtörlesztés, Otthon Start
• Személyi kölcsön: hitelösszeg, futamidő, igénylési feltételek, jövedelemarányos törlesztőrészlet-mutató (JTM)
• Bankszámla: számlavezetési díjak, a díjmentesség feltételei, ingyenes készpénzfelvétel
• Általános: THM, KHR (BAR-lista), hitelközvetítés
Bankspecifikus anyag: CIB Bank, MBH Bank, OTP Bank.

Példák:
• Mennyi a személyi kölcsön maximális futamideje?
• Mennyi az Otthon Start hitel kamata?
• Ugye a számlavezetés mindig ingyenes?

A fenti szűrőkkel termékre és bankra szűkítheted a keresést.`;

export const GREETING_MESSAGE = `Szia! ${HELP_MESSAGE}`;

export const THANKS_MESSAGE =
  "Szívesen! Kérdezz bátran, ha másra is kíváncsi vagy a tudásbázisból.";

// For questions that have nothing to do with banking or finance ("Milyen
// színű az alma?"). Banking questions without a source keep NOT_FOUND_MESSAGE:
// for those "the knowledge base has nothing on this" is the accurate answer.
export const OFF_TOPIC_MESSAGE =
  "Ez a kérdés nem kapcsolódik a tudásbázis témáihoz. Hitelekről, bankszámlákról és a kapcsolódó fogalmakról (például THM, KHR) tudok forrással válaszolni. Ha kíváncsi vagy, mire, kérdezd meg: „Mit tudok tőled kérdezni?”";

/** The fixed reply for an intent, or null for a real question or an off-topic one. */
export function assistantReply(intent: Intent): string | null {
  switch (intent) {
    case "help":
      return HELP_MESSAGE;
    case "greeting":
      return GREETING_MESSAGE;
    case "thanks":
      return THANKS_MESSAGE;
    case "off_topic":
    case "question":
      return null;
  }
}
