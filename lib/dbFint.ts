"use server";

import { Document, MongoClient } from "mongodb";
import {
  FintRawTransaction,
  dbFetchAccounts,
  dbFetchRawTransactions,
} from "./db";
import { GoCardlessTransactionSchema } from "./gocardless";
import {
  RawTransactionNatWest,
  RawTransactionPayPal,
  RawTransactionRevolut,
} from "./importers";
import { readFile } from "fs/promises";
import { ulid } from "ulid";

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

export type FintTransactionMetadata = {
  category: string;
  payee?: string;
};

export type FintTransaction = {
  _id: string;
  accountId: string;

  date: Date;
  hash: string;
  amount: string;
  pending: boolean;

  // Cached metadata
  metadata: FintTransactionMetadata;
};

export async function dbFetchTransactions(accountId: string) {
  return await col<FintTransaction>("transactions")
    .find({ accountId: accountId })
    .toArray();
}

function getAmount(rawEntries: FintRawTransaction[]): string {
  for (const entry of rawEntries) {
    switch (entry._id.source) {
      case "gocardless":
        return (entry.data as GoCardlessTransactionSchema).transactionAmount
          .amount;
      case "manual_natwest":
        return (entry.data as RawTransactionNatWest).Value;
      case "manual_paypal":
        return (entry.data as RawTransactionPayPal).Net; // this won't work bc paypal fees
      case "manual_revolut":
        return (entry.data as RawTransactionRevolut).Amount;
    }
  }

  return "0.00";
}

function getDate(rawEntries: FintRawTransaction[]): Date {
  for (const entry of rawEntries) {
    switch (entry._id.source) {
      case "gocardless":
        return new Date(
          (entry.data as GoCardlessTransactionSchema).bookingDate!
        );
      case "manual_natwest":
        const [dd, mm, yyyy] = (entry.data as RawTransactionNatWest).Date.split(
          "/"
        );
        return new Date(`${yyyy}-${mm}-${dd}`);
      case "manual_paypal":
        return new Date((entry.data as RawTransactionPayPal).Date);
      case "manual_revolut":
        return new Date(
          (entry.data as RawTransactionRevolut)["Completed Date"]
        );
    }
  }

  return new Date("invalid");
}

type Matcher =
  | {
      type: "substring";
      keys: string[];
      substr: string;
    }
  | {
      type: "eq";
      keys: string[];
      str: string;
    }
  | {
      type: "and";
      matchers: Matcher[];
    }
  | {
      type: "or";
      matchers: Matcher[];
    }
  | {
      type: "not";
      matcher: Matcher;
    };

type Rule = {
  match: Matcher;
  set: Partial<FintTransactionMetadata>;
};

function loadRules() {
  return readFile("rules.json").then((f) => JSON.parse(f.toString()) as Rule[]);
}

function jsonKey(obj: any, key: string) {
  if (typeof obj === "undefined") return undefined;
  if (key.length === 0) return obj;
  if (typeof obj === "object") {
    const segments = key.split(".");
    return jsonKey(obj[segments.shift()!], segments.join("."));
  } else {
    return undefined;
  }
}

function jsonKeyI(obj: any, key: string) {
  const arrValues = jsonKey(obj, key + "Array");
  return [
    jsonKey(obj, key),
    ...(Array.isArray(arrValues) ? arrValues : []),
  ].filter((x) => x);
}

function isMatch(obj: any, matcher: Matcher): boolean {
  switch (matcher.type) {
    case "substring": {
      const { keys, substr } = matcher;

      return keys.some((key) => {
        const values = jsonKeyI(obj, key);

        for (const value of values) {
          if (typeof value === "string") {
            if (value.toLowerCase().includes(substr.toLowerCase())) {
              return true;
            }
          }
        }
      });
    }
    case "eq": {
      const { keys, str } = matcher;

      return keys.some((key) => {
        const values = jsonKeyI(obj, key);

        for (const value of values) {
          if (typeof value === "string") {
            if (value.toLowerCase() === str.toLowerCase()) {
              return true;
            }
          }
        }
      });
    }
    case "and":
      return matcher.matchers.every((matcher) => isMatch(obj, matcher));
    case "or":
      return matcher.matchers.some((matcher) => isMatch(obj, matcher));
    case "not":
      return !isMatch(obj, matcher.matcher);
  }
}

function generateMetadata(
  rawEntries: FintRawTransaction[],
  rules: Rule[]
): FintTransactionMetadata {
  let metadata: FintTransactionMetadata = {
    category: "uncategorised",
  };

  for (const entry of rawEntries) {
    for (const rule of rules) {
      if (isMatch(entry.data, rule.match)) {
        metadata = {
          ...metadata,
          ...rule.set,
        };
      }
    }
  }

  return metadata;
}

export async function dbBuildAccountTransactions() {
  const accounts = await dbFetchAccounts();
  const rules = await loadRules();

  for (const account of accounts) {
    if (
      account._id ==
      "01HE61C7GHKCPKPE33Y0JDQFSS" /* "01HE68JZSZ9ME9AQBT5TXJ195J"*/
    ) {
      const rawTransactions = await dbFetchRawTransactions(account._id);
      const transactions = (await dbFetchTransactions(account._id)).reduce(
        (a, b) => ({ ...a, [b.hash]: b }),
        {} as Record<string, FintTransaction>
      );

      const mergedRaw: Record<string, FintRawTransaction[]> = {};
      rawTransactions.forEach(
        (transaction) =>
          (mergedRaw[transaction.hash] = [
            ...(mergedRaw[transaction.hash] ?? []),
            transaction as FintRawTransaction,
          ])
      );

      // TODO: delete pending

      let balance = 0;
      let transactionsList = [];
      for (const hash of Object.keys(mergedRaw)) {
        if (transactions[hash]) {
          console.info("Skip", hash);
          continue;
        }

        const rawEntries = mergedRaw[hash];
        const transaction: FintTransaction = {
          _id: ulid(),
          accountId: account._id,

          hash,
          date: getDate(rawEntries),
          amount: getAmount(rawEntries),
          metadata: generateMetadata(rawEntries, rules),
          pending: !rawEntries.find((x) => !x.pending),
        };

        if (transaction.metadata.category === "uncategorised") {
          console.info(rawEntries);
        }

        balance += parseFloat(transaction.amount) * 100;
        transactionsList.push(transaction);
      }

      console.info("Balance:", balance / 100);

      let items = [];
      let spendItems = [];
      let incomeItems = [];
      for (let i = -30 + 1; i <= 0; i++) {
        const dateToReadTo = new Date();
        dateToReadTo.setDate(dateToReadTo.getDate() + i);

        items.push({
          name: dateToReadTo.toISOString(),
          balance: transactionsList.reduce(
            (p, x) =>
              p +
              ((i === 0 ? true : x.date < dateToReadTo)
                ? parseFloat(x.amount)
                : 0),
            0
          ),
        });
      }

      for (let i = -10 + 1; i <= 0; i++) {
        const dateToReadTo = new Date();
        dateToReadTo.setDate(dateToReadTo.getDate() + i * 3);

        const datePrior = new Date(dateToReadTo);
        datePrior.setDate(datePrior.getDate() - 3);

        spendItems.push({
          name: dateToReadTo.toISOString(),
          balance: -transactionsList
            .filter(
              (x) =>
                x.date > datePrior &&
                (i === 0 ? true : x.date < dateToReadTo) &&
                x.amount.startsWith("-")
            )
            .reduce((x, y) => x + parseFloat(y.amount), 0),
        });

        incomeItems.push({
          name: dateToReadTo.toISOString(),
          balance: transactionsList
            .filter(
              (x) =>
                x.date > datePrior &&
                (i === 0 ? true : x.date < dateToReadTo) &&
                !x.amount.startsWith("-")
            )
            .reduce((x, y) => x + parseFloat(y.amount), 0),
        });
      }

      return [items, spendItems, incomeItems];
    }
  }
}
