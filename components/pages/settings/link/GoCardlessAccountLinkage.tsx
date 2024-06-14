"use client";

import { IndeterminateButton } from "@/components/generic/IndeterminateButton";
import { InfoAlert } from "@/components/generic/InfoAlert";
import {
  FintAccount,
  dbUpdateGoCardlessAccountLink,
  dbUpdateGoCardlessAccountUnlink,
} from "@/lib/db";
import {
  GoCardlessAccount,
  GoCardlessRequisition,
  actionRemoveRequisition,
  actionSyncAccountInformation,
  actionSyncAccountTransactions,
  actionSyncExistingRequisitions,
} from "@/lib/gocardless";
import Link from "next/link";
import { useState } from "react";

export function GoCardlessAccountLinkage({
  gcRequisitions: initialGcRequisitions,
  gcAccounts: initialGcAccounts,
  accounts,
}: {
  gcRequisitions: GoCardlessRequisition[];
  gcAccounts: GoCardlessAccount[];
  accounts: FintAccount[];
}) {
  const [gcRequisitions, setGcRequisitions] = useState(initialGcRequisitions);
  const [gcAccounts, setGcAccounts] = useState(initialGcAccounts);

  const [linkAccount, setLinkAccount] = useState<{
    reference: string;
    accountId: string;
    multi: boolean;
  }>();

  const [selectedMultiAccounts, setSelectedMultiAccounts] = useState<string[]>(
    []
  );

  return (
    <div className="flex w-full">
      <div className="flex-1 flex flex-col gap-2">
        <h2 className="text-2xl">My Requisitions</h2>
        {gcRequisitions.map((requisition) => (
          <details
            key={requisition.reference}
            className="collapse collapse-arrow bg-base-200"
          >
            <summary className="collapse-title text-xl font-medium">
              {requisition.institution_id}
            </summary>
            <div className="collapse-content flex flex-col gap-2">
              <h3 className="text-sm">Accounts</h3>
              {requisition.accounts.map((accountId) => {
                const information = gcAccounts.find(
                  (entry) => entry._id.accountId === accountId
                );

                return (
                  <div
                    key={accountId}
                    className="flex flex-col gap-2 items-center card bg-base-300 rounded-box p-4"
                  >
                    <p>
                      {information?.name ??
                        information?.product ??
                        information?.details ??
                        information?.ownerName ??
                        accountId}{" "}
                      {information?.currency &&
                        information.currency !== "XXX" && (
                          <>({information.currency})</>
                        )}
                    </p>
                    {information?.iban && (
                      <p className="text-xs font-light">
                        IBAN: {information.iban}
                      </p>
                    )}
                    <div className="card-actions justify-end">
                      {information ? (
                        accountId === linkAccount?.accountId ? (
                          <button
                            className="btn btn-error btn-sm"
                            onClick={() => setLinkAccount(undefined)}
                          >
                            {information.currency === "XXX"
                              ? "Finish"
                              : "Cancel"}
                          </button>
                        ) : information.fintAccountId ? (
                          <>
                            <IndeterminateButton
                              disabled={!!linkAccount}
                              onClick={async () => {
                                await actionSyncAccountTransactions(
                                  requisition.reference,
                                  accountId
                                );

                                // TODO: call account rebuild subroutine
                              }}
                            >
                              Sync Now
                            </IndeterminateButton>

                            <IndeterminateButton
                              className={`btn ${
                                linkAccount ? "btn-disabled" : "btn-error"
                              } btn-sm`}
                              onClick={async () => {
                                await dbUpdateGoCardlessAccountUnlink(
                                  requisition.reference,
                                  accountId
                                );

                                setGcAccounts((accounts) =>
                                  accounts.map((entry) =>
                                    entry === information
                                      ? { ...entry, fintAccountId: undefined }
                                      : entry
                                  )
                                );
                              }}
                            >
                              Unlink
                            </IndeterminateButton>
                          </>
                        ) : (
                          <button
                            className={`btn ${
                              linkAccount ? "btn-disabled" : "btn-success"
                            } btn-sm`}
                            onClick={() => {
                              setLinkAccount({
                                reference: requisition.reference,
                                accountId,
                                multi: information.currency === "XXX",
                              });

                              setSelectedMultiAccounts([]);
                            }}
                          >
                            {information.currency === "XXX" && "Multi-"}Link
                          </button>
                        )
                      ) : (
                        <IndeterminateButton
                          className={`btn ${
                            linkAccount ? "btn-disabled" : "btn-primary"
                          } btn-sm`}
                          onClick={async () =>
                            !linkAccount &&
                            actionSyncAccountInformation(
                              requisition.reference,
                              accountId
                            ).then((account) =>
                              setGcAccounts((accounts) => [
                                ...accounts,
                                account,
                              ])
                            )
                          }
                        >
                          Sync Information
                        </IndeterminateButton>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="card-actions justify-end">
                <button
                  className={`btn ${
                    linkAccount ? "btn-disabled" : "btn-error"
                  } btn-sm`}
                  onClick={async () => {
                    if (!linkAccount && confirm("Are you sure?")) {
                      await actionRemoveRequisition(requisition.reference);
                      setGcRequisitions((reqs) =>
                        reqs.filter(
                          (r) => r.reference !== requisition.reference
                        )
                      );
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </details>
        ))}
        {gcRequisitions.length === 0 && (
          <>
            <InfoAlert>No bank accounts associated yet...</InfoAlert>
            <div className="card-actions justify-end">
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () =>
                  confirm(
                    "This will fetch existing requisitions from GoCardless, confirm to continue."
                  ) && actionSyncExistingRequisitions().then(setGcRequisitions)
                }
              >
                Sync Existing
              </button>
            </div>
          </>
        )}
      </div>
      <div className="divider divider-horizontal" />
      <div className="flex-1 flex flex-col gap-2">
        <h2 className="text-2xl">My Accounts</h2>

        {accounts
          .filter((account) => !account.uncontrolled)
          .map((account) => (
            <button
              key={account._id}
              className={`btn ${
                linkAccount
                  ? selectedMultiAccounts.includes(account._id)
                    ? "btn-success"
                    : "btn-primary"
                  : "btn-disabled"
              }`}
              onClick={async () => {
                if (linkAccount) {
                  if (linkAccount.multi) {
                    let accountList = selectedMultiAccounts.includes(
                      account._id
                    )
                      ? selectedMultiAccounts.filter((x) => x !== account._id)
                      : [...selectedMultiAccounts, account._id];

                    setSelectedMultiAccounts(accountList);

                    await dbUpdateGoCardlessAccountLink(
                      linkAccount.reference,
                      linkAccount.accountId,
                      accountList
                    );

                    setGcAccounts((accounts) =>
                      accounts.map((entry) =>
                        entry._id.accountId === linkAccount.accountId
                          ? {
                              ...entry,
                              fintAccountId: accountList,
                            }
                          : entry
                      )
                    );

                    return;
                  }

                  await dbUpdateGoCardlessAccountLink(
                    linkAccount.reference,
                    linkAccount.accountId,
                    account._id
                  );

                  setGcAccounts((accounts) =>
                    accounts.map((entry) =>
                      entry._id.accountId === linkAccount.accountId
                        ? {
                            ...entry,
                            fintAccountId: account._id,
                          }
                        : entry
                    )
                  );

                  setLinkAccount(undefined);
                }
              }}
            >
              {account.name}{" "}
              <div
                className={`badge ${
                  linkAccount ? "badge-secondary" : "badge-neutral"
                }`}
              >
                {account.currency}
              </div>{" "}
              {gcAccounts.find(
                (entry) =>
                  entry.fintAccountId === account._id ||
                  (Array.isArray(entry.fintAccountId) &&
                    entry.fintAccountId.includes(account._id))
              ) && (
                <div
                  className={`badge ${
                    linkAccount ? "badge-error" : "badge-neutral"
                  }`}
                >
                  Linked
                </div>
              )}
            </button>
          ))}

        <Link href="/settings" className="btn btn-neutral">
          Create New
        </Link>
      </div>
    </div>
  );
}
