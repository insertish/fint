"use client";

import { FintAccount, actionBuildAndInsertRawTransactions } from "@/lib/db";
import { useState } from "react";
import {
  Importers,
  RawTransactionNatWest,
  RawTransactionPayPal,
  RawTransactionRevolut,
  importFile,
} from "@/lib/importers";
import hash from "object-hash";
import { IndeterminateButton } from "@/components/generic/IndeterminateButton";

export function ManualImporter({ accounts }: { accounts: FintAccount[] }) {
  const [targetAccounts, setTargetAccounts] = useState<string[]>([]);
  const [importer, setImporter] = useState<Importers>();
  const [loadedData, setLoadedData] = useState<any[]>();

  async function doImport() {
    switch (importer) {
      case "natwest":
        await actionBuildAndInsertRawTransactions(
          (loadedData as RawTransactionNatWest[]).map((data) => ({
            _id: {
              accountId: "",
              source: "manual_natwest",
              transactionId: hash([
                data.Date,
                data.Value,
                data.Balance,
                data.Description,
              ]),
            },

            data,
            pending: false,
          })),
          targetAccounts
        );
        break;

      case "revolut":
        await actionBuildAndInsertRawTransactions(
          (loadedData as RawTransactionRevolut[]).map((data) => ({
            _id: {
              accountId: "",
              source: "manual_revolut",
              transactionId: hash([
                data.Type,
                data["Started Date"],
                data["Completed Date"],
                data.Description,
                data.Amount,
                data.Fee,
                data.Balance,
              ]),
            },

            data,
            pending: false,
          })),
          targetAccounts
        );
        break;

      case "paypal":
        await actionBuildAndInsertRawTransactions(
          (loadedData as RawTransactionPayPal[]).map((data) => ({
            _id: {
              accountId: "",
              source: "manual_paypal",
              transactionId:
                data["Transaction ID"] +
                (data["Balance Impact"] === "Memo" ? `-M` : ""),
            },

            data,
            pending: false,
          })),
          targetAccounts
        );
        break;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="form-control">
        <label className="label">
          <span className="label-text">Select Accounts</span>
        </label>
        <div className="form-control flex flex-row gap-2 flex-wrap">
          {accounts.map((account) => {
            const selected = targetAccounts.includes(account._id);

            return (
              <button
                key={account._id}
                className={`btn btn-sm ${selected ? "btn-primary" : ""}`}
                onClick={() =>
                  setTargetAccounts((accounts) =>
                    selected
                      ? accounts.filter((x) => x !== account._id)
                      : [...accounts, account._id]
                  )
                }
              >
                {account.name}
                {!account.name.includes(account.currency) && (
                  <> ({account.currency})</>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Select Importer</span>
        </label>
        <select
          className="select select-bordered w-full max-w-xs"
          onChange={(e) => {
            setImporter(e.currentTarget.value as Importers);
            setLoadedData(undefined);
          }}
        >
          <option disabled selected>
            Select importer
          </option>
          <option value="paypal">PayPal</option>
          <option value="revolut">Revolut</option>
          <option value="natwest">NatWest</option>
        </select>
      </div>

      {importer && (
        <>
          <div className="form-control w-full max-w-xs">
            <label className="label">
              <span className="label-text">Pick a file</span>
              <span className="label-text-alt">CSV accepted</span>
            </label>
            <input
              type="file"
              className="file-input file-input-bordered w-full max-w-xs"
              onChange={async (e) => {
                if (e.currentTarget.files?.length === 1) {
                  const file = e.currentTarget.files[0];
                  const data = await file.text();
                  setLoadedData(importFile(importer, data));
                }
              }}
            />
          </div>

          <IndeterminateButton
            className={`btn w-full max-w-xs ${
              targetAccounts.length && loadedData
                ? "btn-success"
                : "btn-disabled"
            }`}
            onClick={doImport}
          >
            Import {loadedData?.length ?? 0} transactions
          </IndeterminateButton>
        </>
      )}
    </div>
  );
}
