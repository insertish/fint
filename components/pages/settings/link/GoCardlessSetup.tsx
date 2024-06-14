"use client";

import {
  GoCardlessInstitution,
  actionCreateLink,
  actionGetInstitutions,
} from "@/lib/gocardless";
import { useState } from "react";

/**
 * Setup flow for new bank accounts
 */
export function GoCardlessSetup() {
  const [institutions, setInstitutions] = useState<GoCardlessInstitution[]>([
    {
      id: "SANDBOXFINANCE_SFIN0000",
      name: "Sandbox Finance",
      transaction_total_days: "60",
      countries: [],
      bic: "",
      logo: "",
    },
  ]);

  const [selectedBank, setSelectedBank] = useState<string>();
  const [customEUA, setCustomEUA] = useState(true);

  /**
   * Load banks for a given region
   * @param region Region
   */
  async function loadBanks(region: "gb") {
    setInstitutions(await actionGetInstitutions(region));
  }

  /**
   * Continue setup
   */
  async function cont() {
    if (!selectedBank) return;
    const bank = institutions!.find((i) => i.id === selectedBank);
    if (!bank) return;

    const result = await actionCreateLink(
      bank.id,
      customEUA ? parseInt(bank.transaction_total_days) : 60
    );

    location.replace(result.link);
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl">Connect a new bank account</h2>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Region</span>
        </label>
        <select
          className="select select-bordered w-full"
          onChange={(e) => loadBanks(e.currentTarget.value as "gb")}
        >
          <option disabled selected>
            Select your region
          </option>
          <option value="gb">Great Britain</option>
        </select>
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Bank</span>
        </label>
        <select
          className="select select-bordered w-full"
          onChange={(e) => setSelectedBank(e.currentTarget.value)}
        >
          <option disabled selected>
            Select your bank
          </option>
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name} ({institution.transaction_total_days} days)
            </option>
          ))}
        </select>
      </div>

      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">
            Use custom agreement for maximum historical data (more than 90 days)
          </span>
          <input
            type="checkbox"
            checked={customEUA}
            onChange={(e) => setCustomEUA(e.currentTarget.checked)}
            className="checkbox"
          />
        </label>
      </div>

      <button
        className={`btn ${
          selectedBank ? "btn-success" : "btn-disabled"
        } max-w-[120px]`}
        onClick={cont}
      >
        Continue
      </button>
    </div>
  );
}
