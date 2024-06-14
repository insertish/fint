"use server";

import assert from "assert";
import { ulid } from "ulid";
import { writeFile, readFile, stat } from "fs/promises";
import {
  FintAccount,
  FintRawTransaction,
  dbBuildAndInsertRawTransactions,
  dbDeleteGoCardlessRequisition,
  dbDeletePendingTransactionsFor,
  dbFetchAccount,
  dbFetchGoCardlessAccount,
  dbFetchGoCardlessRequisition,
  dbFetchGoCardlessRequisitions,
  dbInsertGoCardlessAccount,
  dbInsertGoCardlessRequisition,
  dbInsertGoCardlessRequisitionRequest,
  dbInsertRawTransactions,
} from "./db";
import { MongoBulkWriteError } from "mongodb";
import { hashRawTransaction } from "./helpers";

/**
 * Institution available on GoCardless
 */
export type GoCardlessInstitution = {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo: string;
};

/**
 * Requisition for institution on GoCardless
 */
export type GoCardlessRequisitionRequest = {
  id: string;
  link: string;
  reference: string;
};

/**
 * Requisition request for institution on GoCardless
 */
export type GoCardlessRequisition = {
  id: string;
  status: string;
  agreements: string;
  accounts: string[];
  reference: string;
  institution_id: string;
};

/**
 * Account on GoCardless
 */
export type GoCardlessAccount = {
  _id: {
    reference: string;
    accountId: string;
  };

  fintAccountId?: string | string[];
} & Partial<{
  currency: string;
  name: string;
  ownerName: string;
  product: string;

  iban: string;
  resourceId: string;
  bban: string;
  msisdn: string;
  displayName: string;
  cashAccountType: string;
  status: string;
  bic: string;
  linkedAccounts: string;
  maskedPan: string;
  usage: string;
  details: string;
  ownerAddressUnstructured: string[];
  ownerAddressStructued: {
    streetName: string;
    buildingNumber: string;
    townName: string;
    postCode: string;
    country: string;
  };
}>;

/**
 * Transaction schema from GoCardless
 * This is determined by Open Banking standards
 */
export type GoCardlessTransactionSchema = {
  transactionAmount: {
    amount: string;
    currency: string;
  };
} & Partial<{
  transactionId: string;
  internalTransactionId: string;

  entryReference: string;
  endToEndId: string;
  mandateId: string;
  checkId: string;
  creditorId: string;
  bookingDate: string;
  valueDate: string;
  bookingDateTime: string;
  valueDateTime: string;
  currencyExchange: Partial<{
    sourceCurrency: string;
    exchangeRate: string;
    unitCurrency: string;
    targetCurrency: string;
    quotationDate: string;
    contractIdentification: string;
  }>;
  creditorName: string;
  creditorAccount: Partial<{
    iban: string;
    bban: string;
    pan: string;
    maskedPan: string;
    msisdn: string;
    currency: string;
  }>;
  ultimateCreditor: string;
  debtorName: string;
  debtorAccount: Partial<{
    iban: string;
    bban: string;
    pan: string;
    maskedPan: string;
    msisdn: string;
    currency: string;
  }>;
  ultimateDebtor: string;
  remittanceInformationUnstructured: string;
  remittanceInformationUnstructuredArray: string[];
  remittanceInformationStructured: string;
  remittanceInformationStructuredArray: string[];
  additionalInformation: string;
  purposeCode: string;
  bankTransactionCode: string;
  proprietaryBankTransactionCode: string;
}>;

export type GoCardlessTransactions = {
  transactions: {
    booked: GoCardlessTransactionSchema[];
    pending: GoCardlessTransactionSchema[];
  };
};

function goCardlessEnsureSuccess<T>(res: T): T {
  if ((res as { status_code?: string }).status_code) {
    throw res;
  } else {
    return res;
  }
}

/**
 * Get the access token for GoCardless
 * @param internalToken Internal authentication token
 * @returns Access token
 */
export async function getAccessToken(internalToken: string) {
  assert(internalToken === process.env.INTERNAL_TOKEN);

  // Try to load existing token data
  try {
    assert((await stat("accessToken.json")).isFile());

    const { access, access_expires, refresh, refresh_expires } = JSON.parse(
      (await readFile("accessToken.json")).toString()
    );

    const now = +new Date();
    if (access_expires > now) {
      // Access token is valid, use it
      console.debug("Cache hit for token.");
      return access;
    }

    if (refresh === "cancel") throw "Not refreshing token on this machine.";

    if (refresh_expires > now) {
      console.debug("Attempting to refresh access token.");

      const { access, access_expires } = await fetch(
        "https://bankaccountdata.gocardless.com/api/v2/token/refresh/",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh,
          }),
        }
      )
        .then((res) => res.json())
        .then(goCardlessEnsureSuccess);

      // Save the token for later
      writeFile(
        "accessToken.json",
        JSON.stringify({
          access,
          access_expires: +new Date() + access_expires * 1e3,
          refresh,
          refresh_expires,
        })
      );

      return access;
    }
  } catch (err) {}

  // Request a new token
  console.debug("Fetching new access token.");
  const { access, access_expires, refresh, refresh_expires } = await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/token/new/",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret_id: process.env.SECRET_ID,
        secret_key: process.env.SECRET_KEY,
      }),
    }
  )
    .then((res) => res.json())
    .then(goCardlessEnsureSuccess);

  // Save the token for later
  writeFile(
    "accessToken.json",
    JSON.stringify({
      access,
      access_expires: +new Date() + access_expires * 1e3,
      refresh,
      refresh_expires: +new Date() + refresh_expires * 1e3,
    })
  );

  return access;
}

/**
 * Get a list of available banking institutions
 * @param country Country to fetch for
 * @returns List of institutions
 */
export async function actionGetInstitutions(
  country: "gb"
): Promise<GoCardlessInstitution[]> {
  const accessToken = await getAccessToken(process.env.INTERNAL_TOKEN!);

  return await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/institutions/?country=" +
      country, // WARN: no validation
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
    .then((res) => res.json())
    .then(goCardlessEnsureSuccess);
}

export async function actionCreateLink(
  institutionId: string,
  maxHistoricalDays: number = 60
): Promise<GoCardlessRequisitionRequest> {
  const accessToken = await getAccessToken(process.env.INTERNAL_TOKEN!);

  let agreement;
  if (maxHistoricalDays !== 60) {
    agreement = await fetch(
      "https://bankaccountdata.gocardless.com/api/v2/agreements/enduser/",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          institution_id: institutionId,
          max_historical_days: maxHistoricalDays,
        }),
      }
    )
      .then((res) => res.json())
      .then(goCardlessEnsureSuccess)
      .then((data) => data.id);
  }

  const reference = ulid();
  const body: Record<string, string> = {
    reference,
    user_language: "EN",
    institution_id: institutionId,
    redirect: "http://localhost:5274/settings/link/complete",
  };

  if (agreement) body["agreement"] = agreement;

  const result: GoCardlessRequisitionRequest = await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/requisitions/",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    }
  )
    .then((res) => res.json())
    .then(goCardlessEnsureSuccess);

  await dbInsertGoCardlessRequisitionRequest(result);
  return result;
}

export async function actionRemoveRequisition(reference: string) {
  const requisition = await dbFetchGoCardlessRequisition(reference);
  if (!requisition) throw "Missing requisition?";

  const accessToken = await getAccessToken(process.env.INTERNAL_TOKEN!);

  try {
    await fetch(
      "https://bankaccountdata.gocardless.com/api/v2/requisitions/" +
        requisition.id,
      {
        method: "DELETE",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
      .then((res) => res.json())
      .then(goCardlessEnsureSuccess);
  } catch (err) {
    console.error("Failed to remove requisition!", err);
  }

  await dbDeleteGoCardlessRequisition(reference);
}

export async function actionSyncExistingRequisitions(): Promise<
  GoCardlessRequisition[]
> {
  let requisitions = await dbFetchGoCardlessRequisitions();
  if (requisitions.length)
    throw "Cannot sync with existing requisitions in database.";

  const accessToken = await getAccessToken(process.env.INTERNAL_TOKEN!);

  requisitions = await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/requisitions",
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
    .then((res) => res.json())
    .then(goCardlessEnsureSuccess)
    .then((data: { results: GoCardlessRequisition[] }) => data.results);

  for (const requisition of requisitions) {
    await dbInsertGoCardlessRequisition(requisition);
  }

  return requisitions;
}

export async function actionFetchRequisition(
  requisitionId: string
): Promise<GoCardlessRequisition> {
  const accessToken = await getAccessToken(process.env.INTERNAL_TOKEN!);

  return await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/requisitions/" +
      requisitionId, // WARN: no validation
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
    .then((res) => res.json())
    .then(goCardlessEnsureSuccess);
}

export async function actionSyncAccountInformation(
  reference: string,
  accountId: string
): Promise<GoCardlessAccount> {
  const requisition = await dbFetchGoCardlessRequisition(reference);
  if (!requisition) throw "Missing requisition?";
  if (!requisition.accounts.includes(accountId))
    throw "Account does not belong to requisition!";

  const accessToken = await getAccessToken(process.env.INTERNAL_TOKEN!);
  const account = await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/accounts/" +
      accountId +
      "/details",
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
    .then((res) => res.json())
    .then(goCardlessEnsureSuccess)
    .then((data: { account: GoCardlessAccount }) => {
      console.info(data);
      if ((data as any).summary === "Account is Processing")
        throw "Waiting to finish processing...";

      return {
        ...data["account"],
        _id: { reference, accountId },
      };
    });

  await dbInsertGoCardlessAccount(account);
  return account;
}

export async function actionSyncAccountTransactions(
  reference: string,
  gcAccountId: string
) {
  const account = await dbFetchGoCardlessAccount(gcAccountId);
  if (!account) throw "Missing account";
  if (account._id.reference !== reference)
    throw "Account does not belong to requisition!";
  if (!account.fintAccountId) throw "GoCardless account is not linked!";

  const accountIds = Array.isArray(account.fintAccountId)
    ? account.fintAccountId
    : [account.fintAccountId];
  const fintAccounts = (await Promise.all(
    accountIds.map((id) => dbFetchAccount(id)!)
  )) as FintAccount[];
  if (fintAccounts.find((x) => x === null))
    throw "Account(s) don't actually exist?";

  const accessToken = await getAccessToken(process.env.INTERNAL_TOKEN!);
  const transactions: GoCardlessTransactions = await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/accounts/" +
      gcAccountId + // WARN: no validation
      "/transactions",
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
    .then((res) => res.json())
    .then(goCardlessEnsureSuccess);

  await writeFile("tmp.json", JSON.stringify(transactions));
  // const transactions: GoCardlessTransactions = JSON.parse(
  //   (await readFile("tmp.json")).toString()
  // );

  console.info("Fetched transactions");

  // Make sure they actually have IDs
  transactions.transactions.booked.forEach((e) => {
    if (
      typeof e.transactionId !== "string" &&
      typeof e.internalTransactionId !== "string"
    ) {
      console.error(e);
      throw "Missing transaction and internal transaction IDs so there's nothing to pick!";
    }
  });

  // Delete pending
  await Promise.all(accountIds.map((id) => dbDeletePendingTransactionsFor(id)));

  console.info("Deleted pending transactions for all relevant accounts");

  console.info(transactions.transactions.booked);

  // Insert new raw transactions
  await dbBuildAndInsertRawTransactions(
    [
      ...transactions.transactions.booked.map(
        (data) =>
          ({
            _id: {
              accountId: "",
              source: "gocardless",
              transactionId: data.transactionId ?? data.internalTransactionId,
            },
            pending: false,
            data,
          } as FintRawTransaction)
      ),
      ...transactions.transactions.pending.map(
        (data, index) =>
          ({
            _id: {
              accountId: "",
              source: "gocardless",
              transactionId:
                data.transactionId ??
                data.internalTransactionId ??
                `${data.valueDate}-${index}`,
            },
            pending: true,
            data,
          } as FintRawTransaction)
      ),
    ],
    fintAccounts
  );

  console.info("Import complete");
}
