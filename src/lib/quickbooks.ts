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
  return items.map((item: Record<string, unknown>) => ({
    id: item.Id as string,
    name: item.Name as string,
    description: (item.Description as string) || "",
    unitPrice: (item.UnitPrice as number) || 0,
    type: item.Type as string,
  }));
}

export async function findOrCreateCustomer(displayName: string) {
  const escaped = sanitizeQboQuery(displayName);
  const sql = `SELECT * FROM Customer WHERE DisplayName = '${escaped}'`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(sql)}`);
  const customers = data?.QueryResponse?.Customer || [];
  if (customers.length > 0) {
    return { id: customers[0].Id as string, displayName: customers[0].DisplayName as string };
  }
  // Create new customer
  const createData = await qboFetch("/customer", {
    method: "POST",
    body: JSON.stringify({ DisplayName: displayName }),
  });
  return {
    id: createData?.Customer?.Id as string,
    displayName: createData?.Customer?.DisplayName as string,
  };
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
    // Query QBO Preferences to find the correct custom field DefinitionId
    let definitionId = "";
    let fieldName = "Sales Rep";
    try {
      const prefs = await qboFetch("/preferences");
      const customFields = prefs?.QueryResponse?.Preferences?.SalesFormsPrefs?.CustomField
        || prefs?.Preferences?.SalesFormsPrefs?.CustomField
        || [];
      for (const f of customFields as { Name: string; Active: boolean; Type: string; DefinitionId?: string; StringValue?: string }[]) {
        const n = (f.Name || "").toLowerCase();
        if (f.Active && (n.includes("sales") || n.includes("rep") || n.includes("person"))) {
          // SalesFormsPrefs custom fields use "SalesFormsPrefs.SalesCustomName" pattern
          // but invoice custom fields use sequential DefinitionId "1", "2", "3"
          // The index in the array corresponds to the DefinitionId
          fieldName = f.Name;
          break;
        }
      }

      // Also try probing an existing invoice for the exact DefinitionId
      const probe = await qboFetch(`/query?query=${encodeURIComponent("SELECT * FROM Invoice MAXRESULTS 1")}`);
      const sampleInv = (probe?.QueryResponse?.Invoice || [])[0];
      if (sampleInv?.CustomField) {
        const fields = sampleInv.CustomField as { DefinitionId: string; Name: string; Type: string }[];
        for (const f of fields) {
          const n = (f.Name || "").toLowerCase();
          if (n.includes("sales") || n.includes("rep") || n.includes("person")) {
            definitionId = f.DefinitionId;
            fieldName = f.Name;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Failed to detect QBO custom field:", e);
    }

    if (definitionId) {
      invoiceBody.CustomField = [
        {
          DefinitionId: definitionId,
          Name: fieldName,
          Type: "StringType",
          StringValue: salesPerson,
        },
      ];
    } else {
      // Try all 3 possible IDs as last resort
      console.warn("Could not detect custom field ID, trying DefinitionId 1");
      invoiceBody.CustomField = [
        { DefinitionId: "1", Type: "StringType", StringValue: salesPerson },
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
