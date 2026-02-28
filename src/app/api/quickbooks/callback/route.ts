import { NextRequest, NextResponse } from "next/server";

// Escape HTML to prevent XSS
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// GET /api/quickbooks/callback — OAuth redirect handler
// Intuit redirects here with ?code=...&realmId=...&state=...
// We render a minimal HTML page that posts the code back to the parent window
export async function GET(request: NextRequest) {
  const fullUrl = request.url;
  const { searchParams } = new URL(fullUrl);
  const code = searchParams.get("code") || "";
  const realmId = searchParams.get("realmId") || "";
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error) {
    const msg = escapeHtml(errorDesc || error || "Authorization denied");
    return new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fef2f2">
        <div style="text-align:center;max-width:400px">
          <p style="font-size:18px;color:#dc2626;font-weight:600">Connection Failed</p>
          <p style="color:#991b1b;font-size:14px;margin:8px 0">${msg}</p>
          <p style="color:#94a3b8;font-size:13px">Close this window and check your QuickBooks app settings on developer.intuit.com</p>
          <button onclick="window.close()" style="margin-top:16px;padding:8px 24px;background:#dc2626;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">Close</button>
        </div>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Validate code and realmId format (alphanumeric + basic chars only)
  if (!/^[a-zA-Z0-9_\-]+$/.test(code) || !/^[0-9]+$/.test(realmId)) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fef2f2">
        <div style="text-align:center"><p style="color:#dc2626">Invalid callback parameters.</p></div>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const safeCode = escapeHtml(code);
  const safeRealmId = escapeHtml(realmId);

  // Return a page that posts the code to the parent window and closes itself
  const html = `<!DOCTYPE html>
<html>
<head><title>Connecting QuickBooks...</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc">
<div style="text-align:center">
  <p style="font-size:18px;color:#334155">Connecting QuickBooks...</p>
  <p style="color:#94a3b8;font-size:14px">This window will close automatically.</p>
</div>
<script>
  // Post code to the opener (settings page) and close
  if (window.opener) {
    fetch("/api/quickbooks/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "${safeCode}", realmId: "${safeRealmId}" })
    }).then(r => r.json()).then(data => {
      // Signal the parent to refresh — restrict to same origin
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "qbo_connected", companyName: data.companyName || "" }, window.location.origin);
      }
      window.close();
    }).catch(() => {
      document.body.innerHTML = '<p style="text-align:center;margin-top:40vh;font-family:system-ui;color:#dc2626">Connection failed. Please close this window and try again.</p>';
    });
  } else {
    document.body.innerHTML = '<p style="text-align:center;margin-top:40vh;font-family:system-ui">QuickBooks connected. You can close this window.</p>';
  }
</script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
