import { RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { PRODUCT_LABELS } from "@/components/chat/chat-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Filters } from "@/lib/retrieval/types";

const PRODUCT_OPTIONS: { value: Filters["product"]; label: string }[] = [
  { value: "osszes", label: "Összes termék" },
  { value: "lakashitel", label: PRODUCT_LABELS.lakashitel },
  { value: "szemelyi_kolcson", label: PRODUCT_LABELS.szemelyi_kolcson },
  { value: "bankszamla", label: PRODUCT_LABELS.bankszamla },
];

// Select values are strings; "no bank filter" needs one that no bank uses.
const ALL_BANKS = "__minden_bank__";

type BankList =
  | { state: "loading" }
  | { state: "ready"; banks: string[] }
  | { state: "error" };

function useBankList(): BankList {
  const [list, setList] = useState<BankList>({ state: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/banks", { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (
          !response.ok ||
          typeof body !== "object" ||
          body === null ||
          !("banks" in body) ||
          !Array.isArray(body.banks)
        ) {
          throw new Error(`GET /api/banks: ${response.status}`);
        }
        const banks = body.banks.filter(
          (bank): bank is string => typeof bank === "string",
        );
        setList({ state: "ready", banks });
      })
      .catch(() => {
        if (!controller.signal.aborted) setList({ state: "error" });
      });
    return () => controller.abort();
  }, []);
  return list;
}

type FilterBarProps = {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onNewConversation: () => void;
  canReset: boolean;
};

// Filters apply to the next question; changing them keeps the conversation.
export function FilterBar({
  filters,
  onFiltersChange,
  onNewConversation,
  canReset,
}: FilterBarProps) {
  const bankList = useBankList();
  const banks = bankList.state === "ready" ? bankList.banks : [];
  const bankItems = [
    { value: ALL_BANKS, label: "Minden bank" },
    ...banks.map((bank) => ({ value: bank, label: bank })),
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <span
          id="product-filter-label"
          className="text-muted-foreground text-xs"
        >
          Termék
        </span>
        <Select
          items={PRODUCT_OPTIONS}
          value={filters.product}
          onValueChange={(value) => {
            if (value) onFiltersChange({ ...filters, product: value });
          }}
        >
          <SelectTrigger
            aria-labelledby="product-filter-label"
            className="w-full data-[size=default]:h-11 sm:w-48 sm:data-[size=default]:h-8"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <span id="bank-filter-label" className="text-muted-foreground text-xs">
          Bank
        </span>
        <Select
          items={bankItems}
          value={filters.bank ?? ALL_BANKS}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              bank: !value || value === ALL_BANKS ? null : value,
            })
          }
          disabled={bankList.state === "loading"}
        >
          <SelectTrigger
            aria-labelledby="bank-filter-label"
            className="w-full data-[size=default]:h-11 sm:w-48 sm:data-[size=default]:h-8"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bankItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {bankList.state === "error" ? (
          <span className="text-destructive text-xs">
            A banklista most nem érhető el.
          </span>
        ) : null}
      </div>

      <Button
        variant="outline"
        className="h-11 sm:ml-auto sm:h-8"
        onClick={onNewConversation}
        disabled={!canReset}
      >
        <RotateCcwIcon />
        Új beszélgetés
      </Button>
    </div>
  );
}
