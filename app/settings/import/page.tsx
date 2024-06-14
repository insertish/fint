import { ManualImporter } from "@/components/pages/settings/import/ManualImporter";
import { dbFetchAccounts } from "@/lib/db";

export default async function ManualImport() {
  const accounts = await dbFetchAccounts();

  return (
    <div className="flex flex-col gap-8 select-none">
      <div>
        <h1 className="text-4xl">Manual Import</h1>
      </div>

      <ManualImporter accounts={accounts} />
    </div>
  );
}
