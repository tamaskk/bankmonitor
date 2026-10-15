import { describe, expect, it } from "vitest";

import type { ModelAnswer } from "@/lib/generation/schema";
import { normalize, validateAnswer } from "@/lib/generation/validate";

const sources = [
  {
    content:
      "A személyi kölcsön futamideje legfeljebb 10 év (120 hónap).\nA bankok ebben sem egységesek.",
  },
  {
    content: "A lakáshitelek maximális futamideje akár 35 év is lehet.",
  },
];

const answer = (overrides: Partial<ModelAnswer>): ModelAnswer => ({
  status: "answered",
  answer: "A személyi kölcsön futamideje legfeljebb 10 év [1].",
  citations: [
    {
      sourceId: 1,
      quote: "A személyi kölcsön futamideje legfeljebb 10 év (120 hónap).",
    },
  ],
  ...overrides,
});

const errorsOf = (output: ModelAnswer) => {
  const result = validateAnswer(output, sources);
  return result.ok ? [] : result.errors;
};

describe("validateAnswer", () => {
  it("accepts an answer whose markers and verbatim quotes match the sources", () => {
    const output = answer({});

    const result = validateAnswer(output, sources);

    expect(result).toEqual({ ok: true });
  });

  it("rejects an invented quote and names the citation", () => {
    const output = answer({
      citations: [
        {
          sourceId: 1,
          quote: "A személyi kölcsön futamideje legfeljebb 15 év.",
        },
      ],
    });

    const errors = errorsOf(output);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("citation 1 (source 1)");
    expect(errors[0]).toContain("not in the source");
  });

  it("rejects a source id that does not exist", () => {
    const output = answer({
      answer: "A futamidő legfeljebb 10 év [7].",
      citations: [
        {
          sourceId: 7,
          quote: "A személyi kölcsön futamideje legfeljebb 10 év",
        },
      ],
    });

    const errors = errorsOf(output);

    expect(
      errors.some((e) => e.includes("source 7 does not exist (1-2)")),
    ).toBe(true);
  });

  it("rejects a marker without a citation and an answer without markers", () => {
    const markerWithoutCitation = answer({
      answer:
        "A személyi kölcsön legfeljebb 10 év [1], a lakáshitel 35 év [2].",
    });
    const noMarkers = answer({
      answer: "A személyi kölcsön futamideje legfeljebb 10 év.",
    });

    const errorsA = errorsOf(markerWithoutCitation);
    const errorsB = errorsOf(noMarkers);

    expect(errorsA).toContain("marker [2] has no citation");
    expect(errorsB).toContain("the answer has no [n] markers");
    expect(errorsB).toContain(
      "citation for source 1 has no [1] marker in the answer",
    );
  });

  it("rejects a citation whose source is never marked in the answer", () => {
    const output = answer({
      citations: [
        {
          sourceId: 1,
          quote: "A személyi kölcsön futamideje legfeljebb 10 év",
        },
        {
          sourceId: 2,
          quote: "A lakáshitelek maximális futamideje akár 35 év",
        },
      ],
    });

    const errors = errorsOf(output);

    expect(errors).toEqual([
      "citation for source 2 has no [2] marker in the answer",
    ]);
  });

  it("ignores typographic differences: quote marks, line breaks and case", () => {
    const typographic = [
      {
        content: "A díj „egyszeri” – a bank szerint – és\nnem visszatérítendő.",
      },
    ];
    const output: ModelAnswer = {
      status: "answered",
      answer: "A díj egyszeri [1].",
      citations: [
        {
          sourceId: 1,
          quote: 'a díj "egyszeri" - A BANK szerint - és nem visszatérítendő.',
        },
      ],
    };

    const result = validateAnswer(output, typographic);

    expect(result).toEqual({ ok: true });
    expect(normalize("Ő  „Á”\n—x")).toBe('ő "á" -x');
  });

  it("accepts a not_found answer without checking anything", () => {
    const output: ModelAnswer = {
      status: "not_found",
      answer: "",
      citations: [],
    };

    const result = validateAnswer(output, sources);

    expect(result).toEqual({ ok: true });
  });
});
