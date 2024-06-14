import { parse } from "papaparse";

export type Importers = "paypal" | "revolut" | "natwest";

export function importFile(importer: Importers, data: string) {
  switch (importer) {
    case "natwest":
      return importNatWest(data);
    default:
      return importAnyCSV(data);
  }
}

export type RawTransactionRevolut = {
  Type: string;
  Product: string;
  "Started Date": string;
  "Completed Date": string;
  Description: string;
  Amount: string;
  Fee: string;
  Currency: string;
  State: string;
  Balance: string;
};

export type RawTransactionPayPal = {
  Date: string;
  Time: string;
  "Time Zone": string;
  Name: string;
  Type: string;
  Status: string;
  Currency: string;
  Gross: string;
  Fee: string;
  Net: string;
  "From Email Address": string;
  "To Email Address": string;
  "Transaction ID": string;
  "Reference Txn ID": string;
  Balance: string;
  Subject: string;
  Note: string;
  "Balance Impact": "Credit" | "Debit" | "Memo";
};

export type RawTransactionNatWest = {
  Date: string;
  Description: string;
  Balance: string;
  Value: string;
  Type: string;
  "Account Name": string;
  "Account Number": string;
};

function preprocess(data: string) {
  return (
    data
      // Remove carriage returns
      .split(/\r?\n/)
      // Remove empty lines
      .filter((x) => x.trim())
      .join("\n")
  );
}

function importNatWest(data: string) {
  const entries = preprocess(data)
    .split("\n")
    // Remove trailing commas
    .map((x) => (x.endsWith(",") ? x.substring(0, x.length - 1) : x));

  // Remove extranous spaces in headers
  entries[0] = entries[0]
    .split(",")
    .map((seg) => seg.trim())
    .join(",");

  // CSV parser
  return (importAnyCSV(entries.join("\n")) as RawTransactionNatWest[]).map(
    (item) => {
      let date = item.Date;

      // Convert "DD Mo YYYY" dates to "DD/MM/YYYY"
      if (date[2] === " ") {
        const conversions: Record<string, string> = {
          Jan: "01",
          Feb: "02",
          Mar: "03",
          Apr: "04",
          May: "05",
          Jun: "06",
          Jul: "07",
          Aug: "08",
          Sep: "09",
          Oct: "10",
          Nov: "11",
          Dec: "12",
        };

        const [dd, mo, yyyy] = date.split(" ");
        date = `${dd}/${conversions[mo]}/${yyyy}`;
      }

      return {
        ...item,
        Date: date,
      };
    }
  );
}

function importAnyCSV(data: string) {
  const result = parse(preprocess(data), { header: true });

  if (result.errors.length) {
    if (typeof window !== "undefined") {
      alert("Encountered some errors, dumping them in console...");
    }

    console.error(result.errors);
  }

  console.info(result.data);
  return result.data as any[];
}
