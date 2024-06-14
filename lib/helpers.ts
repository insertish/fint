import assert from "assert";
import hash from "object-hash";
import { FintAccount, FintRawTransaction } from "./db";
import { GoCardlessTransactionSchema } from "./gocardless";
import {
  RawTransactionNatWest,
  RawTransactionPayPal,
  RawTransactionRevolut,
} from "./importers";

export function hashRawTransaction(
  account: FintAccount,
  transaction: Omit<FintRawTransaction, "hash">
) {
  let newHash;
  switch (transaction._id.source) {
    case "gocardless": {
      switch (account.hashingStrategy) {
        case "txid": {
          newHash = transaction._id.transactionId;
          break;
        }
        case "paypal": {
          // Merge all fee transactions into the parent transaction
          newHash = (
            transaction.data as GoCardlessTransactionSchema
          ).transactionId
            ?.split("_")
            .shift();

          break;
        }
        case "natwest": {
          const components = (
            [
              "bookingDate", // YYYY-MM-DD
              "remittanceInformationUnstructured", // alphanumeric-only, e.g. "INITIALEURPAYM"...
              "transactionAmount", // -65.67
              // "proprietaryBankTransactionCode", // "TFR" | "IBP" | ...
            ] as (keyof GoCardlessTransactionSchema)[]
          ).map(
            (key) => (transaction.data as GoCardlessTransactionSchema)[key]
          ) as string[];

          components.forEach((entry) => assert(typeof entry !== "undefined"));

          // Strip weird characters
          components[1] = components[1].replace(/[^a-zA-Z0-9]/g, "");

          // Extract the actual amount
          components[2] = (
            components[2] as unknown as GoCardlessTransactionSchema["transactionAmount"]
          ).amount;

          // Strip additional parts of code, e.g. "TFR TO" => "TFR" to comply with CSV export format
          // components[3] = components[3].split(" ").shift()!;

          newHash = hash(components, {
            algorithm: "sha256",
          });

          break;
        }
        case "revolut": {
          const components = (
            [
              "bookingDateTime", // (booking / start date) YYYY-MM-DD HH:MM:SS
              // (may not exist for pending) "valueDateTime", // (value / completion date) YYYY-MM-DD HH:MM:SS
              "transactionAmount", // -65.67
              "proprietaryBankTransactionCode", // CARD_PAYMENT, TOPUP, FEE, etc
            ] as (keyof GoCardlessTransactionSchema)[]
          ).map(
            (key) => (transaction.data as GoCardlessTransactionSchema)[key]
          ) as string[];

          components.forEach((entry) => assert(typeof entry !== "undefined"));

          // Convert date into correct format
          const [a, _] = components[0].split(".");
          const [date, time] = a.split("T");
          components[0] = `${date} ${time}`;

          // Extract the actual amount
          components[1] = (
            components[1] as unknown as GoCardlessTransactionSchema["transactionAmount"]
          ).amount;

          newHash = hash(components, {
            algorithm: "sha256",
          });

          break;
        }
      }

      break;
    }
    case "manual_natwest": {
      const components = (
        [
          "Date", // YYYY-MM-DD
          "Description", // alphanumeric-only, e.g. "INITIALEURPAYM"...
          "Value", // -65.67
          // "Type", // "TFR" | "IBP" | ...
        ] as (keyof RawTransactionNatWest)[]
      ).map(
        (key) => (transaction.data as RawTransactionNatWest)[key]
      ) as string[];

      components.forEach((entry) => assert(typeof entry === "string"));

      // Parse the date and reformat to be ISO
      const [dd, mm, yyyy] = components[0].split("/");
      components[0] = `${yyyy}-${mm}-${dd}`;

      // Strip weird characters
      components[1] = components[1].replace(/[^a-zA-Z0-9]/g, "");

      newHash = hash(components, {
        algorithm: "sha256",
      });

      break;
    }
    case "manual_revolut": {
      const components = (
        [
          "Started Date", // (booking / start date) YYYY-MM-DD HH:MM:SS
          // (may not exist for pending) "Completed Date", // (value / completion date) YYYY-MM-DD HH:MM:SS
          "Amount", // -65.67
          "Type", // CARD_PAYMENT, TOPUP, FEE, etc
        ] as (keyof RawTransactionRevolut)[]
      ).map(
        (key) => (transaction.data as RawTransactionRevolut)[key]
      ) as string[];

      components.forEach((entry) => assert(typeof entry === "string"));

      newHash = hash(components, {
        algorithm: "sha256",
      });

      break;
    }
    case "manual_paypal": {
      const data = transaction.data as RawTransactionPayPal;
      switch (data.Type) {
        case "Partner Fee":
          // Associate the partner fee with the original transaction
          newHash = data["Reference Txn ID"];
          break;
        default:
          newHash = data["Transaction ID"];
      }

      break;
    }
  }

  assert(typeof newHash === "string");

  return newHash;
}
