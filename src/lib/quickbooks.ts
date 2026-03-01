import { prisma } from "./db";

const INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

function getBaseUrl(): string {
  const env = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";
  return env === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

// ── Token helpers ────────────────────────────────────────────────────

// Read QBO client credentials from Settings table, falling back to .env
export async function getClientCredentials() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["qb_client_id", "qb_client_secret", "qb_redirect_uri"] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const clientId = map.qb_client_id || process.env.QUICKBOOKS_CLIENT_ID || "";
  const clientSecret = map.qb_client_secret || process.env.QUICKBOOKS_CLIENT_SECRET || "";
  const redirectUri = map.qb_redirect_uri || process.env.QUICKBOOKS_REDIRECT_URI || "";
  return { clientId, clientSecret, redirectUri };
}

export async function getTokens() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["qb_access_token", "qb_refresh_token", "qb_realm_id", "qb_token_expiry", "qb_company_name"] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  if (!map.qb_access_token || !map.qb_refresh_token || !map.qb_realm_id) return null;
  return {
    accessToken: map.qb_access_token,
    refreshToken: map.qb_refresh_token,
    realmId: map.qb_realm_id,
    expiry: map.qb_token_expiry || "",
    companyName: map.qb_company_name || "",
  };
}

export async function saveTokens(accessToken: string, refreshToken: string, expiresInSeconds: number) {
  const expiry = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const pairs = [
    { key: "qb_access_token", value: accessToken },
    { key: "qb_refresh_token", value: refreshToken },
    { key: "qb_token_expiry", value: expiry },
  ];
  for (const { key, value } of pairs) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
}

export async function clearTokens() {
  await prisma.setting.deleteMany({
    where: { key: { in: ["qb_access_token", "qb_refresh_token", "qb_realm_id", "qb_token_expiry", "qb_company_name"] } },
  });
}

async function refreshIfNeeded() {
  const tokens = await getTokens();
  if (!tokens) return null;

  const expiresAt = new Date(tokens.expiry).getTime();
  // Refresh if token expires within 5 minutes
  if (Date.now() < expiresAt - 5 * 60 * 1000) return tokens;

  const { clientId, clientSecret } = await getClientCredentials();
  if (!clientId || !clientSecret) return null;

  const res = await fetch(INTUIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!res.ok) {
    console.error("QBO token refresh failed:", await res.text());
    return null;
  }

  const data = await res.json();
  await saveTokens(data.access_token, data.refresh_token, data.expires_in);
  return { ...tokens, accessToken: data.access_token, refreshToken: data.refresh_token };
}

// ── Authenticated fetch wrapper ──────────────────────────────────────

export async function qboFetch(path: string, options: RequestInit = {}) {
  let tokens = await refreshIfNeeded();
  if (!tokens) throw new Error("QuickBooks not connected");

  const url = `${getBaseUrl()}/v3/company/${tokens.realmId}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.accessToken}`,
    Accept: "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (options.body) headers["Content-Type"] = "application/json";

  let res = await fetch(url, { ...options, headers });

  // Retry once on 401 (token may have just expired)
  if (res.status === 401) {
    const { clientId, clientSecret } = await getClientCredentials();
    if (!clientId || !clientSecret) throw new Error("QBO credentials missing");

    const refreshRes = await fetch(INTUIT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
    });

    if (!refreshRes.ok) throw new Error("QBO token refresh failed");
    const data = await refreshRes.json();
    await saveTokens(data.access_token, data.refresh_token, data.expires_in);
    tokens = { ...tokens, accessToken: data.access_token };

    headers.Authorization = `Bearer ${tokens.accessToken}`;
    res = await fetch(url, { ...options, headers });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`QBO API error ${res.status}:`, text);
    throw new Error(`QBO API error: ${res.status}`);
  }

  return res.json();
}

// Same as qboFetch but returns raw Response (for binary endpoints like PDF)
export async function qboFetchRaw(path: string, options: RequestInit = {}) {
  let tokens = await refreshIfNeeded();
  if (!tokens) throw new Error("QuickBooks not connected");

  const url = `${getBaseUrl()}/v3/company/${tokens.realmId}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.accessToken}`,
    Accept: "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (options.body) headers["Content-Type"] = "application/json";

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    const { clientId, clientSecret } = await getClientCredentials();
    if (!clientId || !clientSecret) throw new Error("QBO credentials missing");

    const refreshRes = await fetch(INTUIT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
    });

    if (!refreshRes.ok) throw new Error("QBO token refresh failed");
    const data = await refreshRes.json();
    await saveTokens(data.access_token, data.refresh_token, data.expires_in);
    tokens = { ...tokens, accessToken: data.access_token };

    headers.Authorization = `Bearer ${tokens.accessToken}`;
    res = await fetch(url, { ...options, headers });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`QBO API error ${res.status}:`, text);
    throw new Error(`QBO API error: ${res.status}`);
  }

  return res;
}

// ── Input sanitization ───────────────────────────────────────────────

/** Sanitize a string for use in QBO query language (prevent injection) */
function sanitizeQboQuery(input: string): string {
  // Escape single quotes (QBO query syntax) and strip control chars
  return input.replace(/'/g, "\\'").replace(/[\x00-\x1f\x7f]/g, "");
}

/** Validate date format YYYY-MM-DD */
function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

// ── Business logic ───────────────────────────────────────────────────

function mapInvoices(invoices: Record<string, unknown>[]) {
  return invoices.map((inv) => {
    const totalAmt = inv.TotalAmt as number;
    const balance = inv.Balance as number;
    return {
      id: inv.Id as string,
      docNumber: inv.DocNumber as string,
      customerName: (inv.CustomerRef as Record<string, string>)?.name || "",
      customerId: (inv.CustomerRef as Record<string, string>)?.value || "",
      totalAmt,
      balance,
      dueDate: inv.DueDate as string || "",
      txnDate: inv.TxnDate as string || "",
      status: (balance === 0 ? "paid" : balance < totalAmt ? "partial" : "unpaid") as "paid" | "partial" | "unpaid",
    };
  });
}

export async function getOpenInvoices() {
  const sql = `SELECT * FROM Invoice WHERE Balance > '0' ORDER BY DueDate DESC MAXRESULTS 100`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  return mapInvoices(data?.QueryResponse?.Invoice || []);
}

export async function searchInvoices(query: string) {
  const escaped = sanitizeQboQuery(query);
  const sql = `SELECT * FROM Invoice WHERE Balance > '0' AND (DocNumber LIKE '%${escaped}%' OR CustomerRef IN (SELECT Id FROM Customer WHERE DisplayName LIKE '%${escaped}%'))`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  return mapInvoices(data?.QueryResponse?.Invoice || []);
}

export async function getRecentInvoices(options?: {
  search?: string;
  status?: "all" | "paid" | "unpaid";
  dateRange?: "today" | "week" | "month" | "all";
}) {
  const { search, status = "all", dateRange = "today" } = options || {};
  const conditions: string[] = [];

  if (status === "paid") conditions.push("Balance = '0'");
  else if (status === "unpaid") conditions.push("Balance > '0'");

  if (dateRange !== "all") {
    const now = new Date();
    let startDate: string;
    if (dateRange === "today") {
      startDate = now.toISOString().split("T")[0];
    } else if (dateRange === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().split("T")[0];
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().split("T")[0];
    }
    conditions.push(`TxnDate >= '${startDate}'`);
  }

  if (search) {
    const escaped = sanitizeQboQuery(search);
    conditions.push(
      `(DocNumber LIKE '%${escaped}%' OR CustomerRef IN (SELECT Id FROM Customer WHERE DisplayName LIKE '%${escaped}%'))`
    );
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM Invoice${where} ORDERBY TxnDate DESC MAXRESULTS 50`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  return mapInvoices(data?.QueryResponse?.Invoice || []);
}

export async function getCustomers() {
  const sql = `SELECT * FROM Customer WHERE Active = true ORDERBY DisplayName MAXRESULTS 200`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  const customers = data?.QueryResponse?.Customer || [];
  return customers.map((c: Record<string, unknown>) => ({
    id: c.Id as string,
    displayName: c.DisplayName as string,
  }));
}

export async function searchCustomers(query: string) {
  const escaped = sanitizeQboQuery(query);
  const sql = `SELECT * FROM Customer WHERE Active = true AND DisplayName LIKE '%${escaped}%' MAXRESULTS 20`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  const customers = data?.QueryResponse?.Customer || [];
  return customers.map((c: Record<string, unknown>) => ({
    id: c.Id as string,
    displayName: c.DisplayName as string,
  }));
}

export async function getPaymentMethods() {
  const sql = `SELECT * FROM PaymentMethod WHERE Active = true`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  const methods = data?.QueryResponse?.PaymentMethod || [];
  return methods.map((m: Record<string, unknown>) => ({
    id: m.Id as string,
    name: m.Name as string,
    type: m.Type as string, // "CREDIT_CARD" | "NON_CREDIT_CARD"
  }));
}

export async function getItems() {
  const sql = `SELECT * FROM Item WHERE Active = true AND Type IN ('Service', 'NonInventory', 'Inventory') MAXRESULTS 200`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  const items = data?.QueryResponse?.Item || [];
  return items.map((item: Record<string, unknown>) => {
    const fqn = (item.FullyQualifiedName as string) || "";
    const parts = fqn.split(":");
    const category = parts.length > 1 ? parts[0] : "General";
    return {
      id: item.Id as string,
      name: item.Name as string,
      description: (item.Description as string) || "",
      unitPrice: (item.UnitPrice as number) || 0,
      type: item.Type as string,
      category,
    };
  });
}

export async function findOrCreateCustomer(
  displayName: string,
  details?: { phone?: string; address?: string; city?: string; state?: string; zip?: string }
) {
  const escaped = sanitizeQboQuery(displayName);
  const sql = `SELECT * FROM Customer WHERE DisplayName = '${escaped}'`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  const customers = data?.QueryResponse?.Customer || [];
  if (customers.length > 0) {
    return { id: customers[0].Id as string, displayName: customers[0].DisplayName as string };
  }
  // Create new customer with optional phone and address
  const customerBody: Record<string, unknown> = { DisplayName: displayName };
  if (details?.phone) {
    customerBody.PrimaryPhone = { FreeFormNumber: details.phone };
  }
  if (details?.address || details?.city || details?.state || details?.zip) {
    customerBody.BillAddr = {
      ...(details.address ? { Line1: details.address } : {}),
      ...(details.city ? { City: details.city } : {}),
      ...(details.state ? { CountrySubDivisionCode: details.state } : {}),
      ...(details.zip ? { PostalCode: details.zip } : {}),
    };
  }
  const createData = await qboFetch("/customer", {
    method: "POST",
    body: JSON.stringify(customerBody),
  });
  return {
    id: createData?.Customer?.Id as string,
    displayName: createData?.Customer?.DisplayName as string,
  };
}

// ── Sales Rep custom field auto-setup ─────────────────────────────

/** Ensure a "Sales Rep" custom field exists in QBO. Creates it if missing. Caches the DefinitionId. */
async function ensureSalesRepField(): Promise<{ definitionId: string; fieldName: string } | null> {
  // Check cache first
  const cached = await prisma.setting.findUnique({ where: { key: "qb_sales_rep_field_id" } });
  if (cached?.value) {
    const [id, ...nameParts] = cached.value.split("|");
    return { definitionId: id, fieldName: nameParts.join("|") || "Sales Rep" };
  }

  try {
    const prefs = await qboFetch("/preferences");
    const salesPrefs = prefs?.Preferences?.SalesFormsPrefs || {};
    const syncToken = prefs?.Preferences?.SyncToken || prefs?.SyncToken || "0";

    // Check if any slot already has a sales rep field
    for (const idx of ["1", "2", "3"]) {
      const name = salesPrefs[`SalesCustomName${idx}`] || "";
      if (name) {
        const n = name.toLowerCase();
        if (n.includes("sales") || n.includes("rep") || n.includes("person")) {
          // Found existing field — cache and return
          await prisma.setting.upsert({
            where: { key: "qb_sales_rep_field_id" },
            update: { value: `${idx}|${name}` },
            create: { key: "qb_sales_rep_field_id", value: `${idx}|${name}` },
          });
          return { definitionId: idx, fieldName: name };
        }
      }
    }

    // No sales rep field exists — find first unused slot and create it
    // Check which slots are enabled via the CustomField array
    const customFieldArr = salesPrefs.CustomField || [];
    const usedSlots: Record<string, boolean> = {};
    if (Array.isArray(customFieldArr)) {
      for (const entry of customFieldArr) {
        const innerFields = entry?.CustomField || [];
        if (Array.isArray(innerFields)) {
          for (const f of innerFields as { Name: string; BooleanValue?: boolean }[]) {
            const match = (f.Name || "").match(/UseSalesCustom(\d)/);
            if (match && f.BooleanValue) {
              usedSlots[match[1]] = true;
            }
          }
        }
      }
    }

    // Find first free slot
    let freeSlot = "";
    for (const idx of ["1", "2", "3"]) {
      if (!usedSlots[idx] && !salesPrefs[`SalesCustomName${idx}`]) {
        freeSlot = idx;
        break;
      }
    }

    if (!freeSlot) {
      // All slots taken by other fields — just use slot 1 as override
      freeSlot = "1";
    }

    // Enable the custom field via Preferences update
    // Build the CustomField update payload for the inner nested structure
    const customFieldUpdate = [];
    for (const idx of ["1", "2", "3"]) {
      customFieldUpdate.push({
        Name: `SalesFormsPrefs.UseSalesCustom${idx}`,
        Type: "BooleanType",
        BooleanValue: idx === freeSlot ? true : (usedSlots[idx] || false),
      });
    }

    const prefsUpdate: Record<string, unknown> = {
      SyncToken: syncToken,
      SalesFormsPrefs: {
        ...salesPrefs,
        [`SalesCustomName${freeSlot}`]: "Sales Rep",
        CustomField: [{ CustomField: customFieldUpdate }],
      },
    };

    await qboFetch("/preferences", {
      method: "POST",
      body: JSON.stringify(prefsUpdate),
    });

    // Cache the result
    await prisma.setting.upsert({
      where: { key: "qb_sales_rep_field_id" },
      update: { value: `${freeSlot}|Sales Rep` },
      create: { key: "qb_sales_rep_field_id", value: `${freeSlot}|Sales Rep` },
    });

    console.log(`Created QBO custom field "Sales Rep" at slot ${freeSlot}`);
    return { definitionId: freeSlot, fieldName: "Sales Rep" };
  } catch (e) {
    console.error("Failed to ensure sales rep field:", e);
    // Last resort — try slot 1 without caching
    return { definitionId: "1", fieldName: "Sales Rep" };
  }
}

export async function createInvoice(
  customerId: string,
  lines: { itemId: string; amount: number; description?: string }[],
  tax?: { taxAmount: number; taxRate: number },
  salesPerson?: string
) {
  const invoiceLines: Record<string, unknown>[] = lines.map((line) => ({
    Amount: line.amount,
    DetailType: "SalesItemLineDetail",
    Description: line.description || "",
    SalesItemLineDetail: {
      ItemRef: { value: line.itemId },
      UnitPrice: line.amount,
      Qty: 1,
    },
  }));

  if (tax && tax.taxAmount > 0) {
    invoiceLines.push({
      Amount: tax.taxAmount,
      DetailType: "DescriptionOnly",
      Description: `Sales Tax (${tax.taxRate}%)`,
    });
  }

  const invoiceBody: Record<string, unknown> = {
    CustomerRef: { value: customerId },
    Line: invoiceLines,
  };

  if (salesPerson) {
    const fieldInfo = await ensureSalesRepField();
    if (fieldInfo) {
      invoiceBody.CustomField = [
        {
          DefinitionId: fieldInfo.definitionId,
          Name: fieldInfo.fieldName,
          Type: "StringType",
          StringValue: salesPerson,
        },
      ];
    }
  }

  const data = await qboFetch("/invoice", {
    method: "POST",
    body: JSON.stringify(invoiceBody),
  });

  const inv = data?.Invoice;
  return {
    invoiceId: inv?.Id as string,
    docNumber: inv?.DocNumber as string,
    totalAmt: inv?.TotalAmt as number,
  };
}

// ── Sales Report ─────────────────────────────────────────────────────

export async function getSalesReport(startDate: string, endDate: string) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  // 1. Fetch invoices in date range
  const invSql = `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 200`;
  const invData = await qboFetch(`/query?query=${encodeURIComponent(invSql)}`);
  const rawInvoices: Record<string, unknown>[] = invData?.QueryResponse?.Invoice || [];

  // 2. Fetch payments in date range
  const paySql = `SELECT * FROM Payment WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' MAXRESULTS 200`;
  const payData = await qboFetch(`/query?query=${encodeURIComponent(paySql)}`);
  const rawPayments: Record<string, unknown>[] = payData?.QueryResponse?.Payment || [];

  // 3. Fetch payment methods
  const methodSql = `SELECT * FROM PaymentMethod WHERE Active = true`;
  const methodData = await qboFetch(`/query?query=${encodeURIComponent(methodSql)}`);
  const rawMethods: Record<string, unknown>[] = methodData?.QueryResponse?.PaymentMethod || [];

  // 4. Build method ID → name map
  const methodMap: Record<string, string> = {};
  for (const m of rawMethods) {
    methodMap[m.Id as string] = m.Name as string;
  }

  // 5. Build invoice ID → payment details map
  const invoicePayments: Record<string, { id: string; amount: number; method: string; date: string }[]> = {};
  for (const pmt of rawPayments) {
    const pmtId = pmt.Id as string;
    const pmtDate = (pmt.TxnDate as string) || "";
    const methodRef = pmt.PaymentMethodRef as Record<string, string> | undefined;
    const methodName = methodRef?.value ? (methodMap[methodRef.value] || "Unknown") : "Unknown";
    const lines = (pmt.Line as Record<string, unknown>[]) || [];
    for (const line of lines) {
      const linkedTxns = (line.LinkedTxn as Record<string, string>[]) || [];
      for (const link of linkedTxns) {
        if (link.TxnType === "Invoice") {
          const invId = link.TxnId;
          if (!invoicePayments[invId]) invoicePayments[invId] = [];
          invoicePayments[invId].push({
            id: pmtId,
            amount: (line.Amount as unknown as number) || 0,
            method: methodName,
            date: pmtDate,
          });
        }
      }
    }
  }

  // 6. Enrich invoices
  const invoices = rawInvoices.map((inv) => {
    const id = inv.Id as string;
    const totalAmt = inv.TotalAmt as number;
    const balance = inv.Balance as number;
    const payments = invoicePayments[id] || [];

    let paymentMethod: string;
    if (balance === totalAmt && payments.length === 0) {
      paymentMethod = "Unpaid";
    } else if (payments.length === 1) {
      paymentMethod = payments[0].method;
    } else if (payments.length > 1) {
      const uniqueMethods = new Set(payments.map((p) => p.method));
      paymentMethod = uniqueMethods.size === 1 ? payments[0].method : "Multiple";
    } else {
      paymentMethod = "Unpaid";
    }

    const paymentDate = payments.length > 0 ? payments[payments.length - 1].date : "";

    // Extract sales person from CustomField array (QBO custom transaction fields)
    const customFields = (inv.CustomField as Record<string, unknown>[] | undefined) || [];
    const salesRepField = customFields.find((f) => {
      if (typeof f.Name !== "string") return false;
      const n = f.Name.toLowerCase();
      return n.includes("sales person") || n.includes("salesperson") || n.includes("sales rep");
    });
    const salesRep = (salesRepField?.StringValue as string) || "";

    // Extract line items for product breakdown
    const rawLines = (inv.Line as Record<string, unknown>[]) || [];
    const lineItems = rawLines
      .filter((l) => l.DetailType === "SalesItemLineDetail")
      .map((l) => {
        const detail = l.SalesItemLineDetail as Record<string, unknown> | undefined;
        const itemRef = detail?.ItemRef as Record<string, string> | undefined;
        return {
          itemName: itemRef?.name || "Unknown Item",
          itemId: itemRef?.value || "",
          qty: (detail?.UnitPrice !== undefined ? (detail?.Qty as number) : 1) || 1,
          unitPrice: (detail?.UnitPrice as number) || 0,
          amount: (l.Amount as number) || 0,
        };
      });

    // Extract tax info
    const txnTaxDetail = inv.TxnTaxDetail as Record<string, unknown> | undefined;
    const taxAmount = (txnTaxDetail?.TotalTax as number) || 0;

    return {
      id,
      docNumber: (inv.DocNumber as string) || "",
      customerName: (inv.CustomerRef as Record<string, string>)?.name || "",
      customerId: (inv.CustomerRef as Record<string, string>)?.value || "",
      totalAmt,
      balance,
      dueDate: (inv.DueDate as string) || "",
      txnDate: (inv.TxnDate as string) || "",
      status: (balance === 0 ? "paid" : balance < totalAmt ? "partial" : "unpaid") as "paid" | "partial" | "unpaid",
      paymentMethod,
      paymentDate,
      payments,
      salesRep,
      lineItems,
      taxAmount,
    };
  });

  return invoices;
}

export async function getInvoiceDetail(invoiceId: string) {
  const data = await qboFetch(`/invoice/${invoiceId}`);
  const inv = data?.Invoice;
  if (!inv) throw new Error("Invoice not found");

  const totalAmt = inv.TotalAmt as number;
  const balance = inv.Balance as number;

  // Line items
  const rawLines = (inv.Line as Record<string, unknown>[]) || [];
  const lineItems = rawLines
    .filter((l) => l.DetailType === "SalesItemLineDetail")
    .map((l) => {
      const detail = l.SalesItemLineDetail as Record<string, unknown> | undefined;
      const itemRef = detail?.ItemRef as Record<string, string> | undefined;
      return {
        itemName: itemRef?.name || "Unknown Item",
        itemId: itemRef?.value || "",
        qty: (detail?.Qty as number) || 1,
        unitPrice: (detail?.UnitPrice as number) || 0,
        amount: (l.Amount as number) || 0,
      };
    });

  // Custom fields (sales rep + tracking)
  const customFields = (inv.CustomField as Record<string, unknown>[] | undefined) || [];
  const salesRepField = customFields.find((f) => {
    if (typeof f.Name !== "string") return false;
    const n = f.Name.toLowerCase();
    return n.includes("sales person") || n.includes("salesperson") || n.includes("sales rep");
  });
  const trackingField = customFields.find((f) => {
    if (typeof f.Name !== "string") return false;
    const n = f.Name.toLowerCase();
    return n.includes("tracking");
  });

  // Tax
  const txnTaxDetail = inv.TxnTaxDetail as Record<string, unknown> | undefined;
  const taxAmount = (txnTaxDetail?.TotalTax as number) || 0;

  // Customer info
  const customerRef = inv.CustomerRef as Record<string, string> | undefined;

  // Fetch customer details for phone/address
  let customerPhone = "";
  let customerAddress = "";
  if (customerRef?.value) {
    try {
      const custData = await qboFetch(`/customer/${customerRef.value}`);
      const cust = custData?.Customer;
      if (cust) {
        const phone = cust.PrimaryPhone as Record<string, string> | undefined;
        customerPhone = phone?.FreeFormNumber || "";
        const addr = cust.BillAddr as Record<string, string> | undefined;
        if (addr) {
          const parts = [addr.Line1, addr.City, addr.CountrySubDivisionCode, addr.PostalCode].filter(Boolean);
          customerAddress = parts.join(", ");
        }
      }
    } catch { /* customer detail fetch is best-effort */ }
  }

  return {
    id: inv.Id as string,
    docNumber: (inv.DocNumber as string) || "",
    customerName: customerRef?.name || "",
    customerId: customerRef?.value || "",
    customerPhone,
    customerAddress,
    totalAmt,
    balance,
    dueDate: (inv.DueDate as string) || "",
    txnDate: (inv.TxnDate as string) || "",
    status: (balance === 0 ? "paid" : balance < totalAmt ? "partial" : "unpaid") as "paid" | "partial" | "unpaid",
    lineItems,
    salesRep: (salesRepField?.StringValue as string) || "",
    trackingNumber: (trackingField?.StringValue as string) || "",
    taxAmount,
  };
}

/** Ensure a "Tracking #" custom field exists in QBO. Creates it if missing. Caches the DefinitionId. */
async function ensureTrackingField(): Promise<{ definitionId: string; fieldName: string } | null> {
  // Check cache first
  const cached = await prisma.setting.findUnique({ where: { key: "qb_tracking_field_id" } });
  if (cached?.value) {
    const [id, ...nameParts] = cached.value.split("|");
    return { definitionId: id, fieldName: nameParts.join("|") || "Tracking #" };
  }

  try {
    const prefs = await qboFetch("/preferences");
    const salesPrefs = prefs?.Preferences?.SalesFormsPrefs || {};
    const syncToken = prefs?.Preferences?.SyncToken || prefs?.SyncToken || "0";

    // Check if any slot already has a tracking field
    for (const idx of ["1", "2", "3"]) {
      const name = salesPrefs[`SalesCustomName${idx}`] || "";
      if (name && name.toLowerCase().includes("tracking")) {
        await prisma.setting.upsert({
          where: { key: "qb_tracking_field_id" },
          update: { value: `${idx}|${name}` },
          create: { key: "qb_tracking_field_id", value: `${idx}|${name}` },
        });
        return { definitionId: idx, fieldName: name };
      }
    }

    // Find first unused slot (that isn't taken by sales rep)
    const salesRepCached = await prisma.setting.findUnique({ where: { key: "qb_sales_rep_field_id" } });
    const salesRepSlot = salesRepCached?.value?.split("|")[0] || "";

    const customFieldArr = salesPrefs.CustomField || [];
    const usedSlots: Record<string, boolean> = {};
    if (Array.isArray(customFieldArr)) {
      for (const entry of customFieldArr) {
        const innerFields = entry?.CustomField || [];
        if (Array.isArray(innerFields)) {
          for (const f of innerFields as { Name: string; BooleanValue?: boolean }[]) {
            const match = (f.Name || "").match(/UseSalesCustom(\d)/);
            if (match && f.BooleanValue) usedSlots[match[1]] = true;
          }
        }
      }
    }

    let freeSlot = "";
    for (const idx of ["1", "2", "3"]) {
      if (idx !== salesRepSlot && !usedSlots[idx] && !salesPrefs[`SalesCustomName${idx}`]) {
        freeSlot = idx;
        break;
      }
    }
    if (!freeSlot) {
      // Use slot 2 or 3 as fallback
      freeSlot = salesRepSlot === "2" ? "3" : "2";
    }

    // Enable the custom field
    const customFieldUpdate = [];
    for (const idx of ["1", "2", "3"]) {
      customFieldUpdate.push({
        Name: `SalesFormsPrefs.UseSalesCustom${idx}`,
        Type: "BooleanType",
        BooleanValue: idx === freeSlot ? true : (usedSlots[idx] || false),
      });
    }

    const prefsUpdate: Record<string, unknown> = {
      SyncToken: syncToken,
      SalesFormsPrefs: {
        ...salesPrefs,
        [`SalesCustomName${freeSlot}`]: "Tracking #",
        CustomField: [{ CustomField: customFieldUpdate }],
      },
    };

    await qboFetch("/preferences", {
      method: "POST",
      body: JSON.stringify(prefsUpdate),
    });

    await prisma.setting.upsert({
      where: { key: "qb_tracking_field_id" },
      update: { value: `${freeSlot}|Tracking #` },
      create: { key: "qb_tracking_field_id", value: `${freeSlot}|Tracking #` },
    });

    console.log(`Created QBO custom field "Tracking #" at slot ${freeSlot}`);
    return { definitionId: freeSlot, fieldName: "Tracking #" };
  } catch (e) {
    console.error("Failed to ensure tracking field:", e);
    return { definitionId: "2", fieldName: "Tracking #" };
  }
}

export async function updateInvoiceTracking(invoiceId: string, trackingNumber: string) {
  const data = await qboFetch(`/invoice/${invoiceId}`);
  const inv = data?.Invoice;
  if (!inv) throw new Error("Invoice not found");

  const fieldInfo = await ensureTrackingField();
  if (!fieldInfo) throw new Error("Could not configure tracking field");

  const updateBody = {
    Id: inv.Id,
    SyncToken: inv.SyncToken,
    sparse: true,
    CustomField: [
      {
        DefinitionId: fieldInfo.definitionId,
        Name: fieldInfo.fieldName,
        Type: "StringType",
        StringValue: trackingNumber,
      },
    ],
  };

  const result = await qboFetch("/invoice", {
    method: "POST",
    body: JSON.stringify(updateBody),
  });

  return { success: true, invoiceId: result?.Invoice?.Id as string };
}

export async function createPayment(invoiceId: string, customerId: string, amount: number, paymentMethodId?: string) {
  const payment: Record<string, unknown> = {
    TotalAmt: amount,
    CustomerRef: { value: customerId },
    Line: [
      {
        Amount: amount,
        LinkedTxn: [{ TxnId: invoiceId, TxnType: "Invoice" }],
      },
    ],
  };

  if (paymentMethodId) {
    payment.PaymentMethodRef = { value: paymentMethodId };
  }

  const tokens = await getTokens();
  if (!tokens) throw new Error("QuickBooks not connected");

  const data = await qboFetch("/payment", {
    method: "POST",
    body: JSON.stringify(payment),
  });

  return { paymentId: data?.Payment?.Id || null };
}
