import { requireActiveOrg } from "@/lib/api-auth";
import { parseTenantWorkbook } from "@/lib/tenant-import";
import { MAX_IMPORT_BYTES } from "@/lib/xlsx-import";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Reads an uploaded template and reports what it contains. Deliberately writes
 * nothing: the client shows the parsed rows for review, then creates them one
 * at a time against POST /api/tenants so each row gets the same validation and
 * duplicate checks as a hand-typed tenant.
 */
export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  // Cheap rejection before the body is buffered into memory.
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_IMPORT_BYTES) {
    return Response.json({ error: "That file is too large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file was uploaded" }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return Response.json({ error: "That file is too large" }, { status: 413 });
  }
  // Browsers report an empty type for some drag-and-drop sources, so the
  // extension is the fallback rather than the primary check.
  if (file.type && file.type !== XLSX_TYPE) {
    return Response.json(
      { error: "Upload the .xlsx template, not another file type" },
      { status: 415 }
    );
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return Response.json(
      { error: "Upload the .xlsx template, not another file type" },
      { status: 415 }
    );
  }

  const result = await parseTenantWorkbook(await file.arrayBuffer());

  if (result.fatal && result.rows.length === 0) {
    return Response.json({ error: result.fatal }, { status: 400 });
  }

  return Response.json({ rows: result.rows, warning: result.fatal ?? null });
}
