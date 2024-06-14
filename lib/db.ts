"use server";

import { MongoClient, Document, MongoBulkWriteError } from "mongodb";
import {
  GoCardlessAccount,
  GoCardlessRequisition,
  GoCardlessRequisitionRequest,
  GoCardlessTransactionSchema,
} from "./gocardless";
import { ulid } from "ulid";
import hash from "object-hash";
import assert from "assert";
import { hashRawTransaction } from "./helpers";
import {
  RawTransactionNatWest,
  RawTransactionPayPal,
  RawTransactionRevolut,
} from "./importers";
import objectHash from "object-hash";

let client: MongoClient;

function mongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB!);
  }

  return client;
}

function db() {
  return mongo().db("fint");
}

function col<T extends Document>(col: string) {
  return db().collection<T>(col);
}

export type FintAccount = {
  _id: string;
  name: string;
  currency: string;
  hashingStrategy: "txid" | "paypal" | "revolut" | "natwest";
  uncontrolled: boolean;
};

export type FintRawTransaction = {
  hash: string;
  pending: boolean;
} & (
  | {
      _id: {
        accountId: string;
        source: "gocardless";
        transactionId: string;
      };

      data: GoCardlessTransactionSchema;
    }
  | {
      _id: {
        accountId: string;
        source: "manual_natwest";
        transactionId: string;
      };

      data: RawTransactionNatWest;
    }
  | {
      _id: {
        accountId: string;
        source: "manual_revolut";
        transactionId: string;
      };

      data: RawTransactionRevolut;
    }
  | {
      _id: {
        accountId: string;
        source: "manual_paypal";
        transactionId: string;
      };

      data: RawTransactionPayPal;
    }
);

/**
 * Create a new requisition request
 * @param request Request
 */
export async function dbInsertGoCardlessRequisitionRequest(
  request: GoCardlessRequisitionRequest
) {
  await col<{ _id: string; requisition_id: string }>(
    "gocardless_requisition_requests"
  ).insertOne({
    _id: request.reference,
    requisition_id: request.id,
  });
}

/**
 * Fetch existing requisition request
 * @param reference Reference Id
 */
export async function dbFetchGoCardlessRequisitionRequest(reference: string) {
  return await col<{ _id: string; requisition_id: string }>(
    "gocardless_requisition_requests"
  ).findOne({
    _id: reference,
  });
}

/**
 * Delete requisition request
 * @param reference Reference Id
 */
export async function dbDeleteGoCardlessRequisitionRequest(reference: string) {
  await col<{ _id: string; requisition_id: string }>(
    "gocardless_requisition_requests"
  ).deleteOne({
    _id: reference,
  });
}

/**
 * Create a new requisition
 * @param requisition Requisition
 */
export async function dbInsertGoCardlessRequisition(
  requisition: GoCardlessRequisition
) {
  await col<{ _id: string } & GoCardlessRequisition>(
    "gocardless_requisitions"
  ).insertOne({
    _id: requisition.reference,
    ...requisition,
  });
}

export async function dbFetchGoCardlessRequisitions(): Promise<
  GoCardlessRequisition[]
> {
  return await col<{ _id: string } & GoCardlessRequisition>(
    "gocardless_requisitions"
  )
    .find()
    .toArray();
}

export async function dbFetchGoCardlessRequisition(reference: string) {
  return await col<{ _id: string } & GoCardlessRequisition>(
    "gocardless_requisitions"
  ).findOne({
    _id: reference,
  });
}

export async function dbDeleteGoCardlessRequisition(reference: string) {
  const requisition = await dbFetchGoCardlessRequisition(reference);
  if (!requisition) throw "No such requisition.";

  await col<{ _id: { accountId: string } }>("gocardless_accounts").deleteMany({
    "_id.accountId": {
      $in: requisition.accounts,
    },
  });

  await col<{ _id: string } & GoCardlessRequisition>(
    "gocardless_requisitions"
  ).deleteOne({
    _id: reference,
  });
}

export async function dbInsertGoCardlessAccount(account: GoCardlessAccount) {
  await col<GoCardlessAccount>("gocardless_accounts").insertOne(account);
}

export async function dbFetchGoCardlessAccount(
  accountId: string
): Promise<GoCardlessAccount | null> {
  return await col<GoCardlessAccount>("gocardless_accounts").findOne({
    "_id.accountId": accountId,
  });
}

export async function dbFetchGoCardlessAccounts(): Promise<
  GoCardlessAccount[]
> {
  return await col<GoCardlessAccount>("gocardless_accounts").find().toArray();
}

export async function dbUpdateGoCardlessAccountLink(
  reference: string,
  gcAccountId: string,
  fintAccountId: string | string[]
) {
  const requisition = await dbFetchGoCardlessRequisition(reference);
  if (!requisition) throw "Missing requisition?";
  if (!requisition.accounts.includes(gcAccountId))
    throw "Account does not belong to requisition!";

  await col<GoCardlessAccount>("gocardless_accounts").updateOne(
    {
      _id: {
        reference,
        accountId: gcAccountId,
      },
    },
    {
      $set: {
        fintAccountId,
      },
    }
  );
}

export async function dbUpdateGoCardlessAccountUnlink(
  reference: string,
  gcAccountId: string
) {
  const requisition = await dbFetchGoCardlessRequisition(reference);
  if (!requisition) throw "Missing requisition?";
  if (!requisition.accounts.includes(gcAccountId))
    throw "Account does not belong to requisition!";

  await col<GoCardlessAccount>("gocardless_accounts").updateOne(
    {
      _id: {
        reference,
        accountId: gcAccountId,
      },
    },
    {
      $unset: {
        fintAccountId: 1,
      },
    }
  );
}

export async function dbCreateAccount(
  account: Omit<FintAccount, "_id">
): Promise<FintAccount> {
  const createdAccount: FintAccount = {
    ...account,
    _id: ulid(),
  };

  await col<FintAccount>("accounts").insertOne(createdAccount);
  return createdAccount;
}

export async function dbFetchAccounts(): Promise<FintAccount[]> {
  return await col<FintAccount>("accounts").find().toArray();
}

export async function dbFetchAccount(
  accountId: string
): Promise<FintAccount | null> {
  return await col<FintAccount>("accounts").findOne({
    _id: accountId,
  });
}

export async function dbDeletePendingTransactionsFor(accountId: string) {
  await col<FintRawTransaction>("raw_transactions").deleteMany({
    "_id.accountId": accountId,
    pending: true,
  });

  // TODO: also delete in `transactions`
}

export async function dbInsertRawTransactions(
  transactions: FintRawTransaction[]
) {
  return await col<FintRawTransaction>("raw_transactions").insertMany(
    transactions,
    {
      ordered: false,
    }
  );
}

function newCounterHash(counterNecessary: boolean) {
  if (counterNecessary) {
    const seenHashes: Record<string, number> = {};

    return (hash: string) => {
      seenHashes[hash] = (seenHashes[hash] ?? 0) + 1;

      return objectHash([hash, seenHashes[hash]], {
        algorithm: "sha256",
      });
    };
  } else {
    return (hash: string) => hash;
  }
}

function doWeNeedACounter(
  transactions: Omit<FintRawTransaction, "hash">[],
  accounts: FintAccount[]
) {
  for (const entry of transactions) {
    // NOTE: copied code from below
    const account = accounts.find(
      (account) =>
        account!.currency ===
        (entry._id.source === "gocardless"
          ? (entry.data as GoCardlessTransactionSchema).transactionAmount
              .currency
          : "GBP")
    );

    switch (entry._id.source) {
      case "gocardless":
        switch (account?.hashingStrategy) {
          case "natwest":
          case "revolut":
            return true;
        }

        break;
      case "manual_natwest":
      case "manual_revolut":
        return true;
    }
  }

  return false;
}

function transCurrency(transaction: Omit<FintRawTransaction, "hash">) {
  return transaction._id.source === "gocardless"
    ? (transaction.data as GoCardlessTransactionSchema).transactionAmount
        .currency
    : transaction._id.source === "manual_paypal"
    ? (transaction.data as RawTransactionPayPal).Currency
    : transaction._id.source === "manual_natwest"
    ? "GBP"
    : "ERR";
}

export async function dbBuildAndInsertRawTransactions(
  transactions: Omit<FintRawTransaction, "hash">[],
  accounts: FintAccount[]
) {
  try {
    const counterHash = newCounterHash(
      doWeNeedACounter(transactions, accounts)
    );
    const buildRawTransaction = (
      transaction: Omit<FintRawTransaction, "hash">
    ) => {
      const account = accounts.find(
        (account) => account!.currency === transCurrency(transaction)
      );
      if (!account) return null;
      // throw `Could not match an account for transaction ${
      //   transaction._id.transactionId
      // } with currency ${transCurrency(transaction)}!`;
      transaction._id.accountId = account._id;

      const hash = hashRawTransaction(account, transaction);
      return {
        ...transaction,
        hash: counterHash(hash),
      } as FintRawTransaction;
    };

    await dbInsertRawTransactions(
      transactions
        .map((transaction) => buildRawTransaction(transaction)!)
        .filter((x) => x)
    );
  } catch (err) {
    if (err instanceof MongoBulkWriteError) {
      // ignore, would be duplicates
    } else {
      throw err;
    }
  }
}

export async function actionBuildAndInsertRawTransactions(
  transactions: Omit<FintRawTransaction, "hash">[],
  accountIds: string[]
) {
  const fintAccounts = (await Promise.all(
    accountIds.map((id) => dbFetchAccount(id)!)
  )) as FintAccount[];
  if (fintAccounts.find((x) => x === null))
    throw "Account(s) don't actually exist?";

  return dbBuildAndInsertRawTransactions(transactions, fintAccounts);
}

export async function dbFetchRawTransactions(accountId: string) {
  return await col<FintRawTransaction>("raw_transactions")
    .find({ "_id.accountId": accountId })
    .toArray();
}

export async function dbUpdateRawTransactionsGenerateHashesFor(
  accountId: string
) {
  const account = await dbFetchAccount(accountId);
  if (!account) throw "Account doesn't exist";

  const transactions = await dbFetchRawTransactions(accountId);

  const counterHashers: Record<string, (hash: string) => string> = {};
  const getHasher = (source: string) => {
    if (!counterHashers[source])
      counterHashers[source] = newCounterHash(
        doWeNeedACounter(transactions, [account])
      );
    return counterHashers[source];
  };

  for (const transaction of transactions) {
    const newHash = getHasher(transaction._id.source)(
      hashRawTransaction(account, transaction)
    );

    if (transaction._id.transactionId === "1KF65086UW2931810") {
      console.info("hit");
      console.info("rehash", transaction._id.transactionId, newHash);
    }

    if (transaction.hash !== newHash) {
      await col<FintRawTransaction>("raw_transactions").updateOne(
        {
          "_id.accountId": accountId,
          "_id.source": transaction._id.source,
          "_id.transactionId": transaction._id.transactionId,
        },
        {
          $set: {
            hash: newHash,
          },
        }
      );
    }
  }
}
