import {
  dbDeleteGoCardlessRequisitionRequest,
  dbFetchGoCardlessRequisitionRequest,
  dbInsertGoCardlessRequisition,
} from "@/lib/db";
import { actionFetchRequisition } from "@/lib/gocardless";
import { redirect } from "next/navigation";

export default async function CompleteLinkAccount({
  searchParams,
}: {
  searchParams: { ref: string; error: string; details: string };
}) {
  if (searchParams.error) {
    if (searchParams.error === "UserCancelledSession") {
      redirect("/settings/link");
    } else {
      return <h1>{searchParams.details}</h1>;
    }
  }

  if (!searchParams.ref) {
    return <h1>Invalid Request</h1>;
  }

  const requisitionRequest = await dbFetchGoCardlessRequisitionRequest(
    searchParams.ref
  );
  if (!requisitionRequest) {
    return <h1>404: No Request</h1>;
  }

  const requisition = await actionFetchRequisition(
    requisitionRequest.requisition_id
  );

  await dbInsertGoCardlessRequisition(requisition);
  await dbDeleteGoCardlessRequisitionRequest(requisitionRequest._id);

  redirect("/settings/link");
}
