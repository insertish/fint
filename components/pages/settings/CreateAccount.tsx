"use client";

import { FintAccount, dbCreateAccount } from "@/lib/db";
import { useState } from "react";

export function CreateAccount() {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");
  const [uncontrolled, setUncontrolled] = useState(false);
  const [hashingStrategy, setHashingStrategy] =
    useState<FintAccount["hashingStrategy"]>();

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl">Create a new account</h2>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Account Name</span>
        </label>
        <input
          type="text"
          placeholder="Enter a descriptive name"
          className="input input-bordered"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Currency</span>
        </label>
        <input
          type="search"
          list="currencies"
          placeholder="Enter the currency, e.g. GBP, EUR"
          className="input input-bordered"
          value={currency}
          onChange={(e) => setCurrency(e.currentTarget.value)}
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Transaction Hashing Strategy</span>
        </label>
        <select
          className="select select-bordered w-full"
          onChange={(e) =>
            setHashingStrategy(
              e.currentTarget.value as FintAccount["hashingStrategy"]
            )
          }
        >
          <option disabled selected>
            Select strategy
          </option>
          <option value="txid">Just use Transaction ID</option>
          <option value="natwest">NatWest Transactions</option>
        </select>
      </div>

      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">
            Cash / uncontrolled account (this will disable import integrations)
          </span>
          <input
            type="checkbox"
            checked={uncontrolled}
            onChange={(e) => setUncontrolled(e.currentTarget.checked)}
            className="checkbox"
          />
        </label>
      </div>

      <button
        className={`btn ${
          name && currency && hashingStrategy ? "btn-success" : "btn-disabled"
        } max-w-[120px]`}
        onClick={() =>
          name &&
          currency &&
          hashingStrategy &&
          dbCreateAccount({
            name,
            currency,
            hashingStrategy,
            uncontrolled,
          }).then(() => location.reload())
        }
      >
        Create
      </button>
    </div>
  );
}
