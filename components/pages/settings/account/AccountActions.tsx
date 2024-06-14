"use client";

import { IndeterminateButton } from "@/components/generic/IndeterminateButton";
import { dbUpdateRawTransactionsGenerateHashesFor } from "@/lib/db";

export function AccountActions({ accountId }: { accountId: string }) {
  return (
    <>
      <IndeterminateButton
        onClick={() => dbUpdateRawTransactionsGenerateHashesFor(accountId)}
      >
        Rehash
      </IndeterminateButton>
    </>
  );
}
