import { GoCardlessAccountLinkage } from "@/components/pages/settings/link/GoCardlessAccountLinkage";
import { GoCardlessSetup } from "@/components/pages/settings/link/GoCardlessSetup";
import {
  dbFetchAccounts,
  dbFetchGoCardlessAccounts,
  dbFetchGoCardlessRequisitions,
} from "@/lib/db";

export default async function LinkAccount() {
  const gcRequisitions = await dbFetchGoCardlessRequisitions();
  const gcAccounts = await dbFetchGoCardlessAccounts();
  const accounts = await dbFetchAccounts();

  return (
    <div className="flex flex-col gap-8 select-none">
      <div>
        <h1 className="text-4xl">Connect Bank Accounts</h1>
        <h3 className="text-sm">
          Powered by{" "}
          <a href="https://gocardless.com" target="_blank" rel="noreferrer">
            <img src="/gocardless.svg" className="inline h-[0.9em]" />
          </a>
        </h3>
      </div>

      <GoCardlessAccountLinkage
        gcRequisitions={gcRequisitions}
        gcAccounts={gcAccounts}
        accounts={accounts}
      />
      <GoCardlessSetup />
    </div>
  );
}
