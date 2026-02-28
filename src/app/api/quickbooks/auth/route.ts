import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authHelpers";
import { saveTokens, clearTokens, qboFetch, getClientCredentials } from "@/lib/quickbooks";

const INTUIT_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// GET — Build Intuit OAuth URL for the admin to open
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const { clientId, redirectUri } = await getClientCredentials();
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "QuickBooks credentials not configured. Add Client ID and Redirect URI in Settings." }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state: "qbo_connect",
  });

  return NextResponse.json({ url: `${INTUIT_AUTH_URL}?${params}` });
}

// POST — Exchange authorization code for tokens
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { clientId, clientSecret, redirectUri } = await getClientCredentials();
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "QuickBooks credentials not configured. Add them in Settings." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { code, realmId } = body;
    if (!code || !realmId) {
      return NextResponse.json({ error: "code and realmId are required" }, { status: 400 });
    }

    // Exchange code for tokens
    const tokenRes = await fetch(INTUIT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("QBO token exchange failed:", errText);
      return NextResponse.json({ error: "Failed to exchange authorization code" }, { status: 400 });
    }

    const tokenData = await tokenRes.json();

    // Save realm ID
    await prisma.setting.upsert({
      where: { key: "qb_realm_id" },
      update: { value: realmId },
      create: { key: "qb_realm_id", value: realmId },
    });

    // Save tokens
    await saveTokens(tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);

    // Fetch company name
    let companyName = "";
    try {
      const companyData = await qboFetch(`/companyinfo/${realmId}`);
      companyName = companyData?.CompanyInfo?.CompanyName || "";
      if (companyName) {
        await prisma.setting.upsert({
          where: { key: "qb_company_name" },
          update: { value: companyName },
          create: { key: "qb_company_name", value: companyName },
        });
      }
    } catch {
      // Non-critical — company name is just for display
    }

    return NextResponse.json({ success: true, companyName });
  } catch (err) {
    console.error("QBO auth error:", err);
    return NextResponse.json({ error: "Failed to connect QuickBooks" }, { status: 500 });
  }
}

// DELETE — Disconnect QuickBooks (clear all tokens)
export async function DELETE() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    await clearTokens();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("QBO disconnect error:", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
