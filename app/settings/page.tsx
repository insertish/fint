import { InfoAlert } from "@/components/generic/InfoAlert";
import { CreateAccount } from "@/components/pages/settings/CreateAccount";
import { AccountActions } from "@/components/pages/settings/account/AccountActions";
import { dbFetchAccounts } from "@/lib/db";

export default async function Settings() {
  const accounts = await dbFetchAccounts();

  return (
    <div className="flex flex-col gap-8 select-none">
      <div>
        <h1 className="text-4xl">My Accounts</h1>
        <h3 className="text-sm">
          Accounts hold some balance and may be managed automatically or
          manually.
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        {accounts.map((account) => (
          <div key={account._id} className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title">
                {account.name}
                <div className="badge badge-primary">{account.currency}</div>
                {account.uncontrolled && (
                  <div className="badge badge-error">Uncontrolled</div>
                )}
              </h2>
              <p>{account.hashingStrategy}</p>
              <div className="card-actions justify-end">
                <AccountActions accountId={account._id} />
                <button className={`btn btn-disabled btn-sm`}>Delete</button>
              </div>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <InfoAlert>You haven&apos;t created any accounts yet...</InfoAlert>
        )}
      </div>

      <CreateAccount />
    </div>
  );
}
