"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowLeftRight,
  DollarSign,
  ShoppingCart,
  Receipt,
  ArrowUpFromLine,
  Check,
  Delete,
  Loader2,
  Search,
  Plus,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  FileText,
  Camera,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CashSummaryData, QBOInvoice, QBOPaymentMethod, QBOItem, SaleCartItem, QBOCustomer } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────
type Screen =
  | "home"
  | "cashin-mode"
  | "cashin-qbo"
  | "cashin-amount"
  | "cashin-details"
  | "cashin-paid"
  | "cashin-split"
  | "cashin-success"
  | "sale-start"
  | "sale-qbo"
  | "sale-customer"
  | "sale-items"
  | "sale-summary"
  | "sale-payment"
  | "sale-cash-paid"
  | "sale-cash-split"
  | "sale-stripe"
  | "sale-stripe-card"
  | "sale-stripe-reader"
  | "sale-success"
  | "expense-amount"
  | "expense-details"
  | "expense-success"
  | "cashout-amount"
  | "cashout-details"
  | "cashout-success"
  | "transfer-amount"
  | "transfer-success"
  | "previous-sales";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseAmt(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

// ── Floating orbs background ──────────────────────────────────────────
function BgOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-purple-600/8 blur-3xl animate-float-slow" />
      <div className="absolute top-1/3 -right-16 w-56 h-56 rounded-full bg-violet-500/6 blur-3xl animate-float-med" />
      <div className="absolute -bottom-16 left-1/4 w-64 h-64 rounded-full bg-purple-400/5 blur-3xl animate-float-fast" />
      <div className="absolute top-2/3 right-1/3 w-40 h-40 rounded-full bg-fuchsia-500/5 blur-3xl animate-float-slow2" />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<CashSummaryData | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/cash/summary");
      if (res.ok) setSummary(await res.json());
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // ── Navigation ────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>("home");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const prevScreen = useRef<Screen>("home");

  const goTo = (s: Screen, dir: "forward" | "back" = "forward") => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    prevScreen.current = screen;
    setScreen(s);
    setTimeout(() => setAnimating(false), 300);
  };
  const goHome = () => { resetAllForms(); goTo("home", "back"); };
  const goBack = (s: Screen) => goTo(s, "back");

  // ── Form state ────────────────────────────────────────────────────
  const [amount, setAmount] = useState("0"); // invoice total
  const [amountPaid, setAmountPaid] = useState("0"); // what customer handed over
  const [customer, setCustomer] = useState("");
  const [invoice, setInvoice] = useState("");
  const [cashFrom, setCashFrom] = useState("Customer");
  const [toDeposit, setToDeposit] = useState("0");
  const [changeSource, setChangeSource] = useState("REGISTER");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [source, setSource] = useState("REGISTER");
  const [paidBy, setPaidBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [successChange, setSuccessChange] = useState(0);
  const [splitField, setSplitField] = useState<"deposit">("deposit");
  const [transferDirection, setTransferDirection] = useState<"to-deposit" | "to-register">("to-deposit");

  // Expense state
  const [outOfPocket, setOutOfPocket] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [reimbursedSource, setReimbursedSource] = useState("REGISTER");
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  // QuickBooks Online state
  const [qboInvoiceId, setQboInvoiceId] = useState<string | null>(null);
  const [qboCustomerId, setQboCustomerId] = useState<string | null>(null);
  const [qboSearch, setQboSearch] = useState("");
  const [qboConnected, setQboConnected] = useState(false);
  const [qboConfigured, setQboConfigured] = useState(false);
  const [cashInMode, setCashInMode] = useState<"qbo" | "manual" | null>(null);
  const [qboPaymentMethods, setQboPaymentMethods] = useState<QBOPaymentMethod[]>([]);
  const [qboPaymentMethodId, setQboPaymentMethodId] = useState<string>("");

  // Make a Sale state
  const [salePaymentMethod, setSalePaymentMethod] = useState<"cash" | "zelle" | "credit_card" | null>(null);
  const [qboItems, setQboItems] = useState<QBOItem[]>([]);
  const [qboItemsLoading, setQboItemsLoading] = useState(false);
  const [saleCart, setSaleCart] = useState<SaleCartItem[]>([]);
  const [saleItemSearch, setSaleItemSearch] = useState("");
  const [saleCreatingInvoice, setSaleCreatingInvoice] = useState(false);

  // Sales Person state
  const [salesPerson, setSalesPerson] = useState("");
  const [salesPeopleNames, setSalesPeopleNames] = useState<string[]>([]);

  // Tax state
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(8.25);

  // Sale payment source tracking (for back navigation)
  const [salePaymentSource, setSalePaymentSource] = useState<"sale-items" | "sale-summary" | "sale-qbo" | "previous-sales">("sale-items");

  // Recent sales state
  const [recentInvoices, setRecentInvoices] = useState<QBOInvoice[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentFilter, setRecentFilter] = useState<{ search: string; status: "all" | "paid" | "unpaid"; dateRange: "today" | "week" | "month" | "all" }>({ search: "", status: "all", dateRange: "today" });

  // Customer autocomplete state
  const [customerSuggestions, setCustomerSuggestions] = useState<QBOCustomer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const recentSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  // All QBO customers (for browsing)
  const [allCustomers, setAllCustomers] = useState<QBOCustomer[]>([]);
  const [allCustomersLoading, setAllCustomersLoading] = useState(false);

  // Stripe state
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeProcessing, setStripeProcessing] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [stripeReaderStatus, setStripeReaderStatus] = useState("");
  const [stripeCardReady, setStripeCardReady] = useState(false);
  const stripeRef = useRef<import("@stripe/stripe-js").Stripe | null>(null);
  const cardElementRef = useRef<import("@stripe/stripe-js").StripeCardElement | null>(null);
  const cardMountRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<import("@stripe/terminal-js").Terminal | null>(null);

  const resetAllForms = () => {
    setAmount("0"); setAmountPaid("0"); setCustomer(""); setInvoice("");
    setCashFrom("Customer"); setToDeposit("0"); setChangeSource("REGISTER");
    setDescription(""); setCategory("General"); setSource("REGISTER");
    setPaidBy(""); setNotes(""); setSplitField("deposit");
    setSuccessMsg(""); setSuccessChange(0);
    setQboInvoiceId(null); setQboCustomerId(null); setQboSearch(""); setCashInMode(null); setQboPaymentMethodId("");
    setSalePaymentMethod(null); setSaleCart([]); setSaleItemSearch(""); setSaleCreatingInvoice(false);
    setCustomerSuggestions([]); setTaxEnabled(false); setSalesPerson("");
    setOutOfPocket(false); setReceiptFile(null); setReimbursedSource("REGISTER");
    setStripeClientSecret(""); setStripePublishableKey(""); setStripeProcessing(false); setStripeError(""); setStripeReaderStatus(""); setStripeCardReady(false);
  };

  useEffect(() => {
    if (screen.endsWith("-success")) {
      const t = setTimeout(goHome, 10000);
      return () => clearTimeout(t);
    }
  }, [screen]);

  // ── Numpad ────────────────────────────────────────────────────────
  const numpadTarget = (): [string, (v: string) => void] => {
    if (screen === "cashin-paid" || screen === "sale-cash-paid") return [amountPaid, setAmountPaid];
    if (screen === "cashin-split" || screen === "sale-cash-split") return [toDeposit, setToDeposit];
    return [amount, setAmount];
  };

  const handleNumpad = (key: string) => {
    const [val, setter] = numpadTarget();
    if (key === "C") { setter("0"); return; }
    if (key === "⌫") { setter(val.length <= 1 ? "0" : val.slice(0, -1)); return; }
    if (key === "00") { if (val !== "0") setter(val + "00"); return; }
    if (key === ".") { if (!val.includes(".")) setter(val + "."); return; }
    if (val === "0") setter(key); else setter(val + key);
  };

  const fmtAmt = (v: string) => { const n = parseFloat(v); return isNaN(n) ? "$0.00" : formatCurrency(n); };

  // ── Cash-in computed values ───────────────────────────────────────
  const changeDue = () => Math.max(0, Math.round((parseAmt(amountPaid) - parseAmt(amount)) * 100) / 100);
  const splitRegister = () => {
    const paid = parseAmt(amountPaid);
    const dep = parseAmt(toDeposit);
    const chg = changeDue();
    return Math.round((paid - dep - chg) * 100) / 100;
  };

  // ── QBO: load all open invoices on mount ─────────────────────────
  const [qboAllInvoices, setQboAllInvoices] = useState<QBOInvoice[]>([]);
  const [qboLoading, setQboLoading] = useState(false);

  const fetchQboInvoices = async () => {
    setQboLoading(true);
    try {
      const res = await fetch("/api/quickbooks/invoices");
      const data = await res.json();
      setQboConnected(data.connected === true);
      setQboConfigured(data.configured === true);
      setQboAllInvoices(data.invoices || []);
    } catch { /* */ }
    setQboLoading(false);
  };

  const fetchQboPaymentMethods = async () => {
    try {
      const res = await fetch("/api/quickbooks/payment-methods");
      const data = await res.json();
      setQboPaymentMethods(data.methods || []);
    } catch { /* */ }
  };

  useEffect(() => {
    fetchQboInvoices();
    fetchQboPaymentMethods();
    // Load tax rate from settings
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const settings = await res.json();
          if (settings.tax_rate) setTaxRate(parseFloat(settings.tax_rate));
        }
      } catch { /* */ }
    })();
  }, []);

  // Filter invoices locally by search term
  const qboFiltered = qboSearch.length > 0
    ? qboAllInvoices.filter((inv) =>
        inv.customerName.toLowerCase().includes(qboSearch.toLowerCase()) ||
        inv.docNumber.toLowerCase().includes(qboSearch.toLowerCase())
      )
    : qboAllInvoices;

  // ── Fetch sales people from settings ────────────────────────────
  const fetchSalesPeople = async () => {
    if (salesPeopleNames.length > 0) return; // already loaded
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.sales_people) {
          const parsed = JSON.parse(data.sales_people);
          if (Array.isArray(parsed)) setSalesPeopleNames(parsed);
        }
      }
    } catch { /* */ }
  };

  // ── QBO: fetch items for sale-items screen ─────────────────────
  const fetchQboItems = async () => {
    setQboItemsLoading(true);
    try {
      const res = await fetch("/api/quickbooks/items");
      const data = await res.json();
      setQboItems(data.items || []);
    } catch { /* */ }
    setQboItemsLoading(false);
  };

  // ── Recent sales: fetch with filters ────────────────────────────
  const fetchRecentInvoices = async (filters?: typeof recentFilter) => {
    setRecentLoading(true);
    try {
      const f = filters || recentFilter;
      const params = new URLSearchParams();
      if (f.search) params.set("search", f.search);
      params.set("status", f.status);
      params.set("dateRange", f.dateRange);
      const res = await fetch(`/api/quickbooks/recent-invoices?${params}`);
      const data = await res.json();
      setRecentInvoices(data.invoices || []);
    } catch { /* */ }
    setRecentLoading(false);
  };

  // Fetch recent invoices when entering previous-sales
  useEffect(() => {
    if (screen === "previous-sales" && qboConnected) {
      fetchRecentInvoices();
    }
  }, [screen, qboConnected]);

  // Refetch when filters change (except search — that's debounced)
  const handleRecentFilterChange = (updates: Partial<typeof recentFilter>) => {
    const newFilter = { ...recentFilter, ...updates };
    setRecentFilter(newFilter);
    if (!("search" in updates)) {
      fetchRecentInvoices(newFilter);
    }
  };

  const handleRecentSearch = (value: string) => {
    setRecentFilter((prev) => ({ ...prev, search: value }));
    if (recentSearchTimeout.current) clearTimeout(recentSearchTimeout.current);
    recentSearchTimeout.current = setTimeout(() => {
      fetchRecentInvoices({ ...recentFilter, search: value });
    }, 300);
  };

  // ── Customer autocomplete ─────────────────────────────────────
  const fetchCustomerSuggestions = async (query: string) => {
    if (query.length < 2) { setCustomerSuggestions([]); return; }
    setCustomerLoading(true);
    try {
      const res = await fetch(`/api/quickbooks/customers?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setCustomerSuggestions(data.customers || []);
    } catch { /* */ }
    setCustomerLoading(false);
  };

  const handleCustomerInput = (value: string) => {
    setCustomer(value);
    if (customerSearchTimeout.current) clearTimeout(customerSearchTimeout.current);
    customerSearchTimeout.current = setTimeout(() => {
      fetchCustomerSuggestions(value);
    }, 300);
  };

  const selectCustomerSuggestion = (name: string) => {
    setCustomer(name);
    setCustomerSuggestions([]);
  };

  const fetchAllCustomers = async () => {
    setAllCustomersLoading(true);
    try {
      const res = await fetch("/api/quickbooks/customers");
      const data = await res.json();
      setAllCustomers(data.customers || []);
    } catch { /* */ }
    setAllCustomersLoading(false);
  };

  // ── Sale cart helpers ──────────────────────────────────────────
  const addToCart = (item: QBOItem) => {
    setSaleCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) => c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.unitPrice, qty: 1 }];
    });
  };

  const updateCartPrice = (itemId: string, price: number) => {
    setSaleCart((prev) => prev.map((c) => c.itemId === itemId ? { ...c, price } : c));
  };

  const updateCartQty = (itemId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(itemId); return; }
    setSaleCart((prev) => prev.map((c) => c.itemId === itemId ? { ...c, qty } : c));
  };

  const removeFromCart = (itemId: string) => {
    setSaleCart((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const cartTotal = saleCart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const taxAmount = taxEnabled ? Math.round(cartTotal * taxRate) / 100 : 0;
  const cartTotalWithTax = Math.round((cartTotal + taxAmount) * 100) / 100;

  // ── Sale: create invoice from cart ─────────────────────────────
  const submitCreateInvoice = async () => {
    setSaleCreatingInvoice(true);
    try {
      const res = await fetch("/api/quickbooks/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customer,
          lines: saleCart.map((c) => ({ itemId: c.itemId, amount: c.price * c.qty, description: c.name })),
          ...(taxEnabled && taxAmount > 0 ? { taxAmount, taxRate } : {}),
          ...(salesPerson ? { salesPerson } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const inv = data.invoice;
      setAmount(String(inv.totalAmt));
      setInvoice(inv.docNumber);
      setQboInvoiceId(inv.id);
      setQboCustomerId(inv.customerId);
      // Refresh invoices list
      fetchQboInvoices();
      setSalePaymentSource("sale-summary");
      goTo("sale-payment");
    } catch { alert("Failed to create invoice"); }
    setSaleCreatingInvoice(false);
  };

  // ── Sale: submit payment (Zelle / Credit Card — no cash entry) ─
  const submitSaleNonCash = async (payMethod: "zelle" | "credit_card") => {
    setSaving(true);
    try {
      // Find matching payment method
      const methodName = payMethod === "zelle" ? "Zelle" : "Credit Card";
      const method = payMethod === "zelle"
        ? qboPaymentMethods.find((m) => m.name.toLowerCase().includes("zelle"))
        : qboPaymentMethods.find((m) =>
            m.name.toLowerCase().includes("credit card") ||
            m.name.toLowerCase().includes("stripe")
          );

      const qboRes = await fetch("/api/quickbooks/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: qboInvoiceId,
          customerId: qboCustomerId,
          amount: parseAmt(amount),
          paymentMethodId: method?.id || undefined,
        }),
      });
      if (!qboRes.ok) throw new Error();
      setSuccessMsg(`${formatCurrency(parseAmt(amount))} payment recorded via ${methodName} · QBO updated`);
      setSuccessChange(0);
      fetchQboInvoices();
      goTo("sale-success");
    } catch { alert("Failed to record payment"); }
    setSaving(false);
  };

  // ── Sale: submit cash payment (cash entry + QBO payment) ──────
  const submitSaleCash = async () => {
    setSaving(true);
    const paid = parseAmt(amountPaid);
    const dep = parseAmt(toDeposit);
    const chg = changeDue();
    const reg = splitRegister();
    try {
      // 1. Create local cash entry
      const res = await fetch("/api/cash/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CASH_IN", amount: paid, registerAmount: reg, depositAmount: dep,
          changeGiven: chg, category: "Customer", source: changeSource,
          customerName: customer || null, invoiceNumber: invoice || null, date: todayStr(),
        }),
      });
      if (!res.ok) throw new Error();

      let msg = `${formatCurrency(paid)} received — ${formatCurrency(reg)} register, ${formatCurrency(dep)} deposit`;

      // 2. Record payment in QBO
      if (qboInvoiceId && qboCustomerId) {
        try {
          const cashMethod = qboPaymentMethods.find((m) => m.name.toLowerCase().includes("cash"));
          const qboRes = await fetch("/api/quickbooks/payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceId: qboInvoiceId,
              customerId: qboCustomerId,
              amount: parseAmt(amount),
              paymentMethodId: cashMethod?.id || undefined,
            }),
          });
          if (qboRes.ok) msg += " · QBO updated";
          else msg += " · QBO sync failed";
        } catch { msg += " · QBO sync failed"; }
      }

      setSuccessChange(chg);
      setSuccessMsg(msg);
      await fetchSummary();
      fetchQboInvoices();
      goTo("sale-success");
    } catch { alert("Failed to save"); }
    setSaving(false);
  };

  // ── Stripe: init payment intent + go to method choice ──────────
  const initStripePayment = async () => {
    setStripeError("");
    setStripeProcessing(true);
    try {
      const res = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseAmt(amount),
          invoiceNumber: invoice,
          customerName: customer,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create payment");
      }
      const data = await res.json();
      setStripeClientSecret(data.clientSecret);
      setStripePublishableKey(data.publishableKey);
      goTo("sale-stripe");
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : "Stripe error");
      alert(err instanceof Error ? err.message : "Failed to start Stripe payment");
    }
    setStripeProcessing(false);
  };

  // ── Stripe: mount card element via useEffect when card screen is active ──
  useEffect(() => {
    if (screen !== "sale-stripe-card" || !stripePublishableKey || !stripeClientSecret) return;
    let cancelled = false;
    let card: import("@stripe/stripe-js").StripeCardElement | null = null;

    (async () => {
      try {
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(stripePublishableKey);
        if (!stripe || cancelled) return;
        stripeRef.current = stripe;

        const elements = stripe.elements();
        card = elements.create("card", {
          style: {
            base: {
              color: "#ffffff",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              fontSize: "20px",
              fontSmoothing: "antialiased",
              "::placeholder": { color: "#a78bfa" },
              iconColor: "#a78bfa",
            },
            invalid: { color: "#f87171", iconColor: "#f87171" },
          },
        });

        if (cardMountRef.current && !cancelled) {
          card.mount(cardMountRef.current);
          cardElementRef.current = card;
          setStripeCardReady(true);
        }
      } catch (err) {
        if (!cancelled) setStripeError(err instanceof Error ? err.message : "Failed to mount card form");
      }
    })();

    return () => {
      cancelled = true;
      if (card) card.destroy();
      cardElementRef.current = null;
      setStripeCardReady(false);
    };
  }, [screen, stripePublishableKey, stripeClientSecret]);

  // ── Stripe: confirm card payment ──────────────────────────────
  const handleStripeCardSubmit = async () => {
    if (!stripeRef.current || !cardElementRef.current || !stripeClientSecret) return;
    setStripeProcessing(true);
    setStripeError("");
    try {
      const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(
        stripeClientSecret,
        { payment_method: { card: cardElementRef.current } }
      );
      if (error) {
        setStripeError(error.message || "Payment failed");
        setStripeProcessing(false);
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        await onStripePaymentSuccess();
      }
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : "Payment failed");
    }
    setStripeProcessing(false);
  };

  // ── Stripe: after successful charge, record in QBO ────────────
  const onStripePaymentSuccess = async () => {
    try {
      const method = qboPaymentMethods.find((m) =>
        m.name.toLowerCase().includes("credit card") ||
        m.name.toLowerCase().includes("stripe")
      );
      const qboRes = await fetch("/api/quickbooks/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: qboInvoiceId,
          customerId: qboCustomerId,
          amount: parseAmt(amount),
          paymentMethodId: method?.id || undefined,
        }),
      });
      if (qboRes.ok) {
        setSuccessMsg(`${formatCurrency(parseAmt(amount))} charged via Stripe · QBO updated`);
      } else {
        setSuccessMsg(`${formatCurrency(parseAmt(amount))} charged via Stripe · QBO sync failed`);
      }
    } catch {
      setSuccessMsg(`${formatCurrency(parseAmt(amount))} charged via Stripe · QBO sync failed`);
    }
    setSuccessChange(0);
    fetchQboInvoices();
    goTo("sale-success");
  };

  // ── Stripe Terminal: discover + connect + collect ──────────────
  const discoverReaders = async () => {
    setStripeReaderStatus("Initializing terminal...");
    setStripeError("");
    try {
      const { loadStripeTerminal } = await import("@stripe/terminal-js");
      const stripeTerminal = await loadStripeTerminal();
      if (!stripeTerminal) { setStripeError("Failed to load Stripe Terminal"); setStripeReaderStatus(""); return; }
      const terminal = stripeTerminal.create({
        onFetchConnectionToken: async () => {
          const res = await fetch("/api/stripe/connection-token", { method: "POST" });
          const data = await res.json();
          return data.secret;
        },
        onUnexpectedReaderDisconnect: () => {
          setStripeReaderStatus("Reader disconnected");
        },
      });
      terminalRef.current = terminal;

      setStripeReaderStatus("Discovering readers...");
      const discoverResult = await terminal.discoverReaders({ simulated: false });
      if ("error" in discoverResult) {
        setStripeError(discoverResult.error.message || "Failed to discover readers");
        setStripeReaderStatus("");
        return;
      }
      const readers = discoverResult.discoveredReaders;
      if (!readers || readers.length === 0) {
        setStripeReaderStatus("No readers found. Make sure your M2 reader is on and nearby.");
        return;
      }

      setStripeReaderStatus(`Found ${readers.length} reader(s). Connecting...`);
      const connectResult = await terminal.connectReader(readers[0]);
      if ("error" in connectResult) {
        setStripeError(connectResult.error.message || "Failed to connect to reader");
        setStripeReaderStatus("");
        return;
      }

      setStripeReaderStatus("Connected! Collecting payment...");
      await collectTerminalPayment();
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : "Terminal error");
      setStripeReaderStatus("");
    }
  };

  const collectTerminalPayment = async () => {
    if (!terminalRef.current || !stripeClientSecret) return;
    setStripeProcessing(true);
    try {
      const collectResult = await terminalRef.current.collectPaymentMethod(stripeClientSecret);
      if ("error" in collectResult) {
        setStripeError(collectResult.error.message || "Failed to collect payment");
        setStripeProcessing(false);
        return;
      }

      setStripeReaderStatus("Processing payment...");
      const processResult = await terminalRef.current.processPayment(collectResult.paymentIntent);
      if ("error" in processResult) {
        setStripeError(processResult.error.message || "Payment processing failed");
        setStripeProcessing(false);
        return;
      }

      if (processResult.paymentIntent?.status === "succeeded") {
        await onStripePaymentSuccess();
      }
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : "Payment failed");
    }
    setStripeProcessing(false);
  };

  const selectQboInvoice = (inv: QBOInvoice) => {
    setAmount(String(inv.balance));
    setCustomer(inv.customerName);
    setInvoice(inv.docNumber);
    setQboInvoiceId(inv.id);
    setQboCustomerId(inv.customerId);
    setCashFrom("Customer");
    setQboSearch("");
  };

  // ── API calls ─────────────────────────────────────────────────────
  const submitCashIn = async () => {
    setSaving(true);
    const paid = parseAmt(amountPaid);
    const dep = parseAmt(toDeposit);
    const chg = changeDue();
    const reg = splitRegister();
    try {
      const res = await fetch("/api/cash/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CASH_IN", amount: paid, registerAmount: reg, depositAmount: dep,
          changeGiven: chg, category: cashFrom, source: changeSource,
          customerName: customer || null, invoiceNumber: invoice || null, date: todayStr(),
        }),
      });
      if (!res.ok) throw new Error();
      setSuccessChange(chg);
      let msg = `${formatCurrency(paid)} received — ${formatCurrency(reg)} register, ${formatCurrency(dep)} deposit`;

      // Record payment in QuickBooks if linked to a QBO invoice
      if (qboInvoiceId && qboCustomerId) {
        try {
          const qboRes = await fetch("/api/quickbooks/payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId: qboInvoiceId, customerId: qboCustomerId, amount: parseAmt(amount), paymentMethodId: qboPaymentMethodId || undefined }),
          });
          if (qboRes.ok) msg += " · QBO updated";
          else msg += " · QBO sync failed";
        } catch { msg += " · QBO sync failed"; }
      }

      setSuccessMsg(msg);
      await fetchSummary();
      // Refresh QBO invoices list after payment
      if (qboInvoiceId) fetchQboInvoices();
      goTo("cashin-success");
    } catch { alert("Failed to save"); }
    setSaving(false);
  };


  const submitExpense = async () => {
    setSaving(true);
    const a = parseAmt(amount);
    try {
      const fd = new FormData();
      fd.append("amount", String(a)); fd.append("description", description);
      fd.append("category", category);
      fd.append("source", outOfPocket ? reimbursedSource : source);
      fd.append("paidByName", paidBy || session?.user?.name || "");
      fd.append("outOfPocket", String(outOfPocket)); fd.append("date", todayStr());
      if (receiptFile) fd.append("receipt", receiptFile);
      const res = await fetch("/api/cash/expenses", { method: "POST", body: fd });
      if (!res.ok) throw new Error();

      let msg = `${formatCurrency(a)} expense recorded — ${description}`;
      if (outOfPocket) msg += " (out of pocket)";

      setSuccessMsg(msg);
      await fetchSummary();
      goTo("expense-success");
    } catch { alert("Failed to save"); }
    setSaving(false);
  };

  const submitCashOut = async () => {
    setSaving(true);
    const a = parseAmt(amount);
    try {
      const res = await fetch("/api/cash/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CASH_OUT", amount: a, registerAmount: 0, depositAmount: 0, changeGiven: 0,
          category, source, customerName: customer || null, invoiceNumber: invoice || null,
          notes: notes || null, date: todayStr(),
        }),
      });
      if (!res.ok) throw new Error();
      setSuccessMsg(`${formatCurrency(a)} cash out from ${source.toLowerCase()}`);
      await fetchSummary();
      goTo("cashout-success");
    } catch { alert("Failed to save"); }
    setSaving(false);
  };

  const submitTransfer = async () => {
    setSaving(true);
    const a = parseAmt(amount);
    const type = transferDirection === "to-deposit" ? "DEPOSIT" : "WITHDRAWAL";
    try {
      const res = await fetch("/api/cash/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, amount: a, registerAmount: a, depositAmount: a, changeGiven: 0,
          category: "Transfer", source: "REGISTER", notes: notes || null, date: todayStr(),
        }),
      });
      if (!res.ok) throw new Error();
      const label = transferDirection === "to-deposit" ? "Register → Deposit" : "Deposit → Register";
      setSuccessMsg(`${formatCurrency(a)} transferred (${label})`);
      await fetchSummary();
      goTo("transfer-success");
    } catch { alert("Failed to save"); }
    setSaving(false);
  };

  // ── Reusable UI ───────────────────────────────────────────────────

  const BackBtn = ({ onPress }: { onPress: () => void }) => (
    <button onClick={onPress}
      className="absolute top-3 left-3 z-20 w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-purple-500/20 active:bg-white/10 active:scale-95 transition-all">
      <ArrowLeft className="w-6 h-6 text-purple-200" />
    </button>
  );

  const Numpad = ({ onNext, nextLabel = "Next", nextDisabled = false, nextColor = "bg-purple-600 hover:bg-purple-500 active:bg-purple-700" }: {
    onNext: () => void; nextLabel?: string; nextDisabled?: boolean; nextColor?: string;
  }) => {
    const keys = [["1","2","3","⌫"],["4","5","6","C"],["7","8","9","00"],[".","0","__NEXT__"]];
    return (
      <div className="grid grid-cols-4 gap-2 p-3">
        {keys.flat().map((k, i) => {
          if (k === "__NEXT__") return (
            <button key={i} onClick={onNext} disabled={nextDisabled || saving}
              className={cn("col-span-2 min-h-[72px] rounded-xl text-xl font-bold transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100 flex items-center justify-center gap-2", nextColor)}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : nextLabel}
            </button>
          );
          const isAction = k === "⌫" || k === "C";
          return (
            <button key={i} onClick={() => handleNumpad(k)}
              className={cn("min-h-[72px] rounded-xl text-2xl font-semibold transition-all active:scale-95",
                isAction ? "bg-white/10 hover:bg-white/15 active:bg-white/20 text-purple-200"
                         : "bg-white/5 hover:bg-white/10 active:bg-white/15 text-white border border-purple-500/10")}>
              {k === "⌫" ? <Delete className="w-6 h-6 mx-auto" /> : k}
            </button>
          );
        })}
      </div>
    );
  };

  const AmountDisplay = ({ value, label, color = "text-white" }: { value: string; label?: string; color?: string }) => (
    <div className="flex-1 flex flex-col items-center justify-center py-6">
      {label && <p className="text-purple-300/60 text-base mb-2">{label}</p>}
      <p className={cn("text-5xl font-black tabular-nums tracking-tight", color)}>{fmtAmt(value)}</p>
    </div>
  );

  const Pills = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={cn("px-4 py-3 rounded-xl text-base font-medium transition-all active:scale-95",
            value === o ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25" : "bg-white/5 text-purple-200 border border-purple-500/20 hover:bg-white/10")}>
          {o}
        </button>
      ))}
    </div>
  );

  const SourceToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="flex gap-2">
      {["REGISTER", "DEPOSIT"].map((s) => (
        <button key={s} onClick={() => onChange(s)}
          className={cn("flex-1 py-3 rounded-xl text-base font-semibold transition-all active:scale-95",
            value === s ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25" : "bg-white/5 text-purple-300/60 border border-purple-500/20 hover:bg-white/10")}>
          {s === "REGISTER" ? "Register" : "Deposit"}
        </button>
      ))}
    </div>
  );

  const BigInput = ({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) => (
    <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-4 rounded-xl bg-white/5 border border-purple-500/20 text-xl text-white placeholder-purple-300/30 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition" />
  );

  const SuccessScreen = ({ changeAmt, invoiceId }: { changeAmt?: number; invoiceId?: string | null }) => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
      <div className="w-28 h-28 rounded-full bg-emerald-500/15 border-2 border-emerald-400/30 flex items-center justify-center animate-pop-in">
        <Check className="w-16 h-16 text-emerald-400" />
      </div>
      {changeAmt !== undefined && changeAmt > 0 && (
        <div className="text-center animate-fade-up">
          <p className="text-purple-300/60 text-xl mb-1">CHANGE DUE</p>
          <p className="text-7xl font-black text-emerald-400 tabular-nums">{formatCurrency(changeAmt)}</p>
        </div>
      )}
      <p className="text-purple-200/70 text-lg text-center max-w-md animate-fade-up">{successMsg}</p>
      <div className="flex gap-3 animate-fade-up">
        {invoiceId && (
          <button onClick={() => window.open(`/api/quickbooks/invoices/${invoiceId}/pdf`, "_blank")}
            className="mt-4 px-6 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-lg font-semibold transition-all text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            View Invoice
          </button>
        )}
        <button onClick={goHome}
          className="mt-4 px-8 py-4 rounded-xl bg-white/10 border border-purple-500/20 hover:bg-white/15 active:scale-95 text-xl font-semibold transition-all text-purple-100">
          Done
        </button>
      </div>
    </div>
  );

  const ScreenWrap = ({ id, children }: { id: Screen; children: React.ReactNode }) => {
    const isActive = screen === id;
    const wasActive = prevScreen.current === id;
    const isTransitioning = animating && isActive;
    const isLeaving = animating && wasActive && !isActive;
    return (
      <div className={cn(
        "absolute inset-0 flex flex-col",
        isTransitioning && "transition-opacity duration-300 ease-out",
        isLeaving && "transition-opacity duration-200 ease-out",
        isActive
          ? "opacity-100"
          : isLeaving
            ? "opacity-0"
            : "hidden",
        !isActive && "pointer-events-none"
      )}>{children}</div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950">
      <style jsx global>{`
        @keyframes float-slow { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.1); } }
        @keyframes float-med { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,30px) scale(1.05); } }
        @keyframes float-fast { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,20px) scale(1.08); } }
        @keyframes float-slow2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,-20px) scale(1.12); } }
        .animate-float-slow { animation: float-slow 20s ease-in-out infinite; }
        .animate-float-med { animation: float-med 15s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 12s ease-in-out infinite; }
        .animate-float-slow2 { animation: float-slow2 18s ease-in-out infinite; }
        @keyframes pop-in { 0% { transform: scale(0); opacity:0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity:1; } }
        .animate-pop-in { animation: pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes fade-up { 0% { transform: translateY(20px); opacity:0; } 100% { transform: translateY(0); opacity:1; } }
        .animate-fade-up { animation: fade-up 0.4s ease-out 0.2s both; }
      `}</style>

      <BgOrbs />

      <div className="flex-1 relative overflow-hidden z-10">
        {/* HOME */}
        <ScreenWrap id="home">
          <div className="flex-1 flex flex-col">
            {/* Admin stats bar */}
            {session?.user?.role === "ADMIN" && summary && (
              <div className="flex items-center justify-center gap-4 px-3 pt-3">
                <div className="flex items-center gap-6 px-5 py-2.5 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/[0.08]">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-purple-300/50">Register</p>
                    <p className="text-sm font-semibold text-white">{formatCurrency(summary.registerBalance)}</p>
                  </div>
                  <div className="w-px h-7 bg-white/10" />
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-purple-300/50">Today&apos;s Cash Sales</p>
                    <p className="text-sm font-semibold text-white">{formatCurrency(summary.todayCashIn)}</p>
                  </div>
                  <div className="w-px h-7 bg-white/10" />
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-purple-300/50">Deposit</p>
                    <p className="text-sm font-semibold text-white">{formatCurrency(summary.depositBalance)}</p>
                  </div>
                </div>
              </div>
            )}
            {/* Logo area */}
            <div className="flex items-center justify-center pt-6 pb-2">
              <Image src="/kloud-logo.png" alt="Kloud" width={64} height={64} className="opacity-60" />
            </div>
            {/* Button grid */}
            <div className="flex-1 flex flex-col gap-3 p-3">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <button onClick={() => { resetAllForms(); goTo("sale-start"); }}
                  className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-3 shadow-xl shadow-emerald-900/30 border border-emerald-500/20">
                  <ShoppingCart className="w-11 h-11" />
                  <span className="text-xl font-bold">Make a Sale</span>
                </button>
                <button onClick={() => { resetAllForms(); goTo(qboConfigured ? "cashin-mode" : "cashin-amount"); }}
                  className="rounded-2xl bg-gradient-to-br from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-3 shadow-xl shadow-cyan-900/30 border border-cyan-500/20">
                  <DollarSign className="w-11 h-11" />
                  <span className="text-xl font-bold">Enter Cash</span>
                </button>
                <button onClick={() => { resetAllForms(); goTo("expense-amount"); }}
                  className="rounded-2xl bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-3 shadow-xl shadow-orange-900/30 border border-orange-500/20">
                  <Receipt className="w-11 h-11" />
                  <span className="text-xl font-bold">Log Expense</span>
                </button>
              </div>
              {session?.user?.role === "ADMIN" ? (
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <button onClick={() => { resetAllForms(); goTo("cashout-amount"); }}
                    className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-3 shadow-xl shadow-red-900/30 border border-red-500/20">
                    <ArrowUpFromLine className="w-11 h-11" />
                    <span className="text-xl font-bold">Cash Out</span>
                  </button>
                  <button onClick={() => { resetAllForms(); goTo("transfer-amount"); }}
                    className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-3 shadow-xl shadow-blue-900/30 border border-blue-500/20">
                    <ArrowLeftRight className="w-11 h-11" />
                    <span className="text-xl font-bold">Transfer</span>
                  </button>
                  <button onClick={() => { resetAllForms(); fetchRecentInvoices(); goTo("previous-sales"); }}
                    className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-3 shadow-xl shadow-indigo-900/30 border border-indigo-500/20">
                    <FileText className="w-11 h-11" />
                    <span className="text-xl font-bold">Previous Sales</span>
                  </button>
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-1 gap-3">
                  <button onClick={() => { resetAllForms(); fetchRecentInvoices(); goTo("previous-sales"); }}
                    className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-3 shadow-xl shadow-indigo-900/30 border border-indigo-500/20">
                    <FileText className="w-11 h-11" />
                    <span className="text-xl font-bold">Previous Sales</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </ScreenWrap>

        {/* ──── CASH IN: Mode Selection (QBO connected only) ──── */}
        <ScreenWrap id="cashin-mode">
          <BackBtn onPress={goHome} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            <p className="text-purple-300/60 text-xl font-semibold">Enter Cash</p>
            <p className="text-purple-300/40 text-base text-center">How would you like to enter this transaction?</p>
            <div className="w-full max-w-sm space-y-4">
              <button onClick={() => goTo("cashin-qbo")}
                className="w-full py-6 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.97] transition-all flex flex-col items-center gap-2 shadow-xl shadow-emerald-900/30 border border-emerald-500/20">
                <Search className="w-8 h-8" />
                <span className="text-xl font-bold">Import from QuickBooks</span>
                <span className="text-sm text-emerald-200/60">Search invoices by customer or invoice #</span>
              </button>
              <button onClick={() => goTo("cashin-amount")}
                className="w-full py-6 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.97] transition-all flex flex-col items-center gap-2 border border-purple-500/20">
                <DollarSign className="w-8 h-8 text-purple-300" />
                <span className="text-xl font-bold text-purple-200">Enter Manually</span>
                <span className="text-sm text-purple-300/40">Type in the amount and details</span>
              </button>
            </div>
          </div>
        </ScreenWrap>

        {/* ──── CASH IN: QBO Search ──── */}
        <ScreenWrap id="cashin-qbo">
          <BackBtn onPress={() => goBack("cashin-mode")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-purple-300/60 text-base">Open Invoices</p>
              <button onClick={fetchQboInvoices} disabled={qboLoading}
                className="text-xs text-purple-300/40 hover:text-purple-200 transition">
                {qboLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
              </button>
            </div>
            {!qboConnected ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Search className="w-8 h-8 text-amber-400" />
                </div>
                <p className="text-amber-300 text-lg font-semibold">QuickBooks Not Connected</p>
                <p className="text-purple-300/40 text-center text-sm max-w-xs">
                  Go to Settings &rarr; QuickBooks Online and click &quot;Connect QuickBooks&quot; to link your account.
                </p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/40" />
                  <input
                    type="text"
                    placeholder="Filter by name or invoice #..."
                    value={qboSearch}
                    onChange={(e) => setQboSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-purple-500/20 text-base text-white placeholder-purple-300/30 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition"
                  />
                </div>
                {qboLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  </div>
                ) : qboFiltered.length > 0 ? (
                  <div className="space-y-2">
                    {qboFiltered.map((inv) => (
                      <button key={inv.id} onClick={() => {
                        selectQboInvoice(inv);
                        setAmountPaid(String(inv.balance));
                        setCashInMode("qbo");
                        goTo("cashin-paid");
                      }}
                        className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all border border-purple-500/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-base font-semibold text-white">#{inv.docNumber}</p>
                            <p className="text-sm text-purple-300/50">{inv.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-emerald-400">{formatCurrency(inv.balance)}</p>
                            {inv.totalAmt !== inv.balance && (
                              <p className="text-xs text-amber-300/60">of {formatCurrency(inv.totalAmt)}</p>
                            )}
                            {inv.dueDate && <p className="text-xs text-purple-300/30">Due {inv.dueDate}</p>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : qboAllInvoices.length === 0 ? (
                  <p className="text-center text-purple-300/30 py-8">No open invoices in QuickBooks</p>
                ) : (
                  <p className="text-center text-purple-300/30 py-8">No invoices match &quot;{qboSearch}&quot;</p>
                )}
              </>
            )}
          </div>
          <div className="p-3">
            <button onClick={() => { setQboSearch(""); goTo("cashin-amount"); }}
              className="w-full py-3 rounded-xl bg-white/5 border border-purple-500/20 hover:bg-white/10 active:scale-95 text-base font-medium transition-all text-purple-200">
              Enter Manually Instead
            </button>
          </div>
        </ScreenWrap>

        {/* ──── CASH IN: Invoice Total (Manual path) ──── */}
        <ScreenWrap id="cashin-amount">
          <BackBtn onPress={() => goBack(qboConfigured ? "cashin-mode" : "home")} />
          <p className="text-center text-purple-300/60 text-base mt-4">Step 1 — Invoice Total</p>
          <AmountDisplay value={amount} label="How much does the customer owe?" color="text-emerald-400" />
          <Numpad onNext={() => goTo("cashin-details")} nextDisabled={parseAmt(amount) <= 0} nextColor="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700" />
        </ScreenWrap>

        {/* ──── CASH IN: Customer / Invoice (Manual path only) ──── */}
        <ScreenWrap id="cashin-details">
          <BackBtn onPress={() => goBack("cashin-amount")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-5">
            <p className="text-center text-purple-300/60 text-base">Step 2 — Customer Info</p>

            <div className="bg-white/5 rounded-xl p-4 text-center border border-purple-500/10">
              <p className="text-xs text-purple-300/40 mb-1">Invoice Total</p>
              <p className="text-3xl font-bold text-emerald-400">{fmtAmt(amount)}</p>
            </div>

            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Cash From</label>
              <Pills options={["Customer", "Vendor Return", "Refund", "Transfer", "Other"]} value={cashFrom} onChange={setCashFrom} />
            </div>
            {cashFrom === "Customer" && (
              <>
                <div>
                  <label className="block text-sm text-purple-300/50 mb-1.5">Customer Name</label>
                  <BigInput placeholder="Customer name" value={customer} onChange={setCustomer} />
                </div>
                <div>
                  <label className="block text-sm text-purple-300/50 mb-1.5">Invoice #</label>
                  <BigInput placeholder="Invoice number" value={invoice} onChange={setInvoice} />
                </div>
              </>
            )}
          </div>
          <div className="p-3">
            <button onClick={() => { setAmountPaid(amount); goTo("cashin-paid"); }}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xl font-bold transition-all">Next</button>
          </div>
        </ScreenWrap>

        {/* ──── CASH IN: Amount Paid → auto change ──── */}
        <ScreenWrap id="cashin-paid">
          <BackBtn onPress={() => goBack(cashInMode === "qbo" ? "cashin-qbo" : "cashin-details")} />
          <p className="text-center text-purple-300/60 text-base mt-4">{cashInMode === "qbo" ? "Step 2" : "Step 3"} — Amount Paid</p>
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-2">
            {qboInvoiceId && (
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs text-emerald-300">#{invoice} · {customer}</p>
                </div>
                {qboPaymentMethods.length > 0 && (
                  <div className="flex gap-2 flex-wrap justify-center">
                    {qboPaymentMethods.map((m) => (
                      <button key={m.id} onClick={() => setQboPaymentMethodId(m.id === qboPaymentMethodId ? "" : m.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                          qboPaymentMethodId === m.id
                            ? "bg-purple-500/20 border-purple-400 text-purple-200"
                            : "bg-white/5 border-purple-500/20 text-purple-300/50 hover:bg-white/10"
                        )}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-purple-300/40 text-sm">Invoice: {fmtAmt(amount)}</p>
            <p className="text-5xl font-black tabular-nums text-white">{fmtAmt(amountPaid)}</p>
            {parseAmt(amountPaid) >= parseAmt(amount) && changeDue() > 0 && (
              <div className="mt-2 px-6 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <p className="text-emerald-400 text-2xl font-black tabular-nums">Change: {formatCurrency(changeDue())}</p>
              </div>
            )}
          </div>
          <Numpad onNext={() => goTo("cashin-split")} nextDisabled={parseAmt(amountPaid) < parseAmt(amount)}
            nextLabel={parseAmt(amountPaid) < parseAmt(amount) ? "Insufficient" : "Next"}
            nextColor="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700" />
        </ScreenWrap>

        {/* ──── CASH IN: Split ──── */}
        <ScreenWrap id="cashin-split">
          <BackBtn onPress={() => goBack("cashin-paid")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-2 space-y-3">
            <p className="text-center text-purple-300/60 text-base">Step 4 — Split</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-xl p-3 text-center border border-purple-500/10">
                <p className="text-xs text-purple-300/40">Paid</p>
                <p className="text-xl font-bold text-white">{fmtAmt(amountPaid)}</p>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
                <p className="text-xs text-emerald-300/60">Change</p>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(changeDue())}</p>
              </div>
            </div>

            <div className="w-full text-left p-4 rounded-xl border-2 border-purple-400 bg-white/5">
              <p className="text-xs text-purple-300/50">To Deposit (use numpad below)</p>
              <p className="text-2xl font-bold tabular-nums">{fmtAmt(toDeposit)}</p>
            </div>

            <div className={cn("p-4 rounded-xl border", splitRegister() < 0 ? "bg-red-500/5 border-red-500/20" : "bg-white/[0.03] border-purple-500/10")}>
              <p className="text-xs text-purple-300/50">{splitRegister() < 0 ? "From Register (change)" : "To Register (auto)"}</p>
              <p className={cn("text-2xl font-bold tabular-nums", splitRegister() < 0 ? "text-red-400" : "text-purple-300")}>
                {splitRegister() < 0 ? `-${formatCurrency(Math.abs(splitRegister()))}` : formatCurrency(splitRegister())}
              </p>
            </div>

            {changeDue() > 0 && (
              <div>
                <label className="block text-xs text-purple-300/50 mb-1.5">Change from?</label>
                <SourceToggle value={changeSource} onChange={setChangeSource} />
              </div>
            )}
          </div>
          <Numpad onNext={submitCashIn} nextLabel="Record Sale" nextDisabled={parseAmt(toDeposit) > parseAmt(amountPaid)}
            nextColor="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700" />
        </ScreenWrap>

        {/* ──── CASH IN: Success ──── */}
        <ScreenWrap id="cashin-success"><SuccessScreen changeAmt={successChange} invoiceId={qboInvoiceId} /></ScreenWrap>

        {/* ──── MAKE A SALE: Start ──── */}
        <ScreenWrap id="sale-start">
          <BackBtn onPress={goHome} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            <p className="text-purple-300/60 text-xl font-semibold">Make a Sale</p>

            {!qboConnected ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Search className="w-8 h-8 text-amber-400" />
                </div>
                <p className="text-amber-300 text-lg font-semibold">QuickBooks Not Connected</p>
                <p className="text-purple-300/40 text-center text-sm max-w-xs">
                  Go to Settings &rarr; QuickBooks Online and click &quot;Connect QuickBooks&quot; to use Make a Sale.
                </p>
              </div>
            ) : (
              <div className="w-full max-w-sm grid grid-cols-2 gap-3">
                <button onClick={() => goTo("sale-qbo")}
                  className="py-6 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.97] transition-all flex flex-col items-center gap-2 shadow-xl shadow-emerald-900/30 border border-emerald-500/20">
                  <Search className="w-8 h-8" />
                  <span className="text-lg font-bold">From QuickBooks</span>
                  <span className="text-xs text-emerald-200/60">Existing invoice</span>
                </button>
                <button onClick={() => { fetchAllCustomers(); fetchSalesPeople(); goTo("sale-customer"); }}
                  className="py-6 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 active:scale-[0.97] transition-all flex flex-col items-center gap-2 shadow-xl shadow-violet-900/30 border border-violet-500/20">
                  <Plus className="w-8 h-8" />
                  <span className="text-lg font-bold">New Sale</span>
                  <span className="text-xs text-violet-200/60">Build invoice</span>
                </button>
              </div>
            )}
          </div>
        </ScreenWrap>

        {/* ──── MAKE A SALE: QBO Invoice Search ──── */}
        <ScreenWrap id="sale-qbo">
          <BackBtn onPress={() => goBack("sale-start")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-purple-300/60 text-base">Open Invoices</p>
              <button onClick={fetchQboInvoices} disabled={qboLoading}
                className="text-xs text-purple-300/40 hover:text-purple-200 transition">
                {qboLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/40" />
              <input type="text" placeholder="Filter by name or invoice #..." value={qboSearch}
                onChange={(e) => setQboSearch(e.target.value)} autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-purple-500/20 text-base text-white placeholder-purple-300/30 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition" />
            </div>
            {qboLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>
            ) : qboFiltered.length > 0 ? (
              <div className="space-y-2">
                {qboFiltered.map((inv) => (
                  <button key={inv.id} onClick={() => {
                    selectQboInvoice(inv);
                    setSalePaymentSource("sale-qbo");
                    goTo("sale-payment");
                  }}
                    className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all border border-purple-500/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-white">#{inv.docNumber}</p>
                        <p className="text-sm text-purple-300/50">{inv.customerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-400">{formatCurrency(inv.balance)}</p>
                        {inv.totalAmt !== inv.balance && (
                          <p className="text-xs text-amber-300/60">of {formatCurrency(inv.totalAmt)}</p>
                        )}
                        {inv.dueDate && <p className="text-xs text-purple-300/30">Due {inv.dueDate}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : qboAllInvoices.length === 0 ? (
              <p className="text-center text-purple-300/30 py-8">No open invoices in QuickBooks</p>
            ) : (
              <p className="text-center text-purple-300/30 py-8">No invoices match &quot;{qboSearch}&quot;</p>
            )}
          </div>
        </ScreenWrap>

        {/* ──── MAKE A SALE: Customer Name ──── */}
        <ScreenWrap id="sale-customer">
          <BackBtn onPress={() => goBack("sale-start")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-4">
            <p className="text-center text-purple-300/60 text-xl font-semibold">New Sale — Customer</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/40" />
              <input type="text" placeholder="Search or enter customer name..." value={customer}
                onChange={(e) => handleCustomerInput(e.target.value)}
                className="w-full pl-10 pr-10 py-4 rounded-xl bg-white/5 border border-purple-500/20 text-xl text-white placeholder-purple-300/30 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition" />
              {customerLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                </div>
              )}
              {customerSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl bg-slate-900 border border-purple-500/20 shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                  {customerSuggestions.map((c) => (
                    <button key={c.id} onClick={() => selectCustomerSuggestion(c.displayName)}
                      className="w-full text-left px-4 py-3 text-base text-white hover:bg-white/10 active:bg-white/15 transition border-b border-purple-500/10 last:border-b-0">
                      {c.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Browsable QBO customer list */}
            <p className="text-purple-300/50 text-sm font-semibold">QuickBooks Customers</p>
            {allCustomersLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>
            ) : allCustomers.length > 0 ? (
              <div className="space-y-1.5">
                {allCustomers
                  .filter((c) => !customer || c.displayName.toLowerCase().includes(customer.toLowerCase()))
                  .map((c) => (
                    <button key={c.id} onClick={() => { setCustomer(c.displayName); setCustomerSuggestions([]); }}
                      className={cn("w-full text-left px-4 py-3 rounded-xl transition-all active:scale-[0.98] border",
                        customer === c.displayName
                          ? "bg-violet-600/20 border-violet-500/30 text-white"
                          : "bg-white/5 border-purple-500/10 text-purple-200 hover:bg-white/10"
                      )}>
                      {c.displayName}
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-center text-purple-300/30 py-4 text-sm">No customers found</p>
            )}
          </div>
          {/* Sales Person picker */}
          <div className="px-4 pb-2">
            <p className="text-purple-300/50 text-sm font-semibold mb-2">Sales Person</p>
            {salesPeopleNames.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {salesPeopleNames.map((name) => (
                  <button key={name} onClick={() => setSalesPerson(salesPerson === name ? "" : name)}
                    className={cn("px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] border",
                      salesPerson === name
                        ? "bg-violet-600/30 border-violet-500/40 text-white"
                        : "bg-white/5 border-purple-500/10 text-purple-200 hover:bg-white/10"
                    )}>
                    {name}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Or type a name..."
              value={salesPerson}
              onChange={(e) => setSalesPerson(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-purple-500/20 text-base text-white placeholder-purple-300/30 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition"
            />
          </div>
          <div className="p-3">
            <button onClick={() => { setCustomerSuggestions([]); fetchQboItems(); goTo("sale-items"); }} disabled={!customer.trim()}
              className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-xl font-bold transition-all disabled:opacity-30">
              Next — Choose Products
            </button>
          </div>
        </ScreenWrap>

        {/* ──── MAKE A SALE: Product Cart ──── */}
        <ScreenWrap id="sale-items">
          <BackBtn onPress={() => goBack("sale-customer")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-3">
            <p className="text-center text-purple-300/60 text-base">New Sale — Products</p>
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/40" />
              <input type="text" placeholder="Search products..." value={saleItemSearch}
                onChange={(e) => setSaleItemSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-purple-500/20 text-base text-white placeholder-purple-300/30 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition" />
            </div>

            {/* Product grid */}
            {qboItemsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {qboItems
                  .filter((item) => !saleItemSearch || item.name.toLowerCase().includes(saleItemSearch.toLowerCase()))
                  .map((item) => (
                    <button key={item.id} onClick={() => addToCart(item)}
                      className="text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.97] transition-all border border-purple-500/10">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(item.unitPrice)}</p>
                    </button>
                  ))}
              </div>
            )}

            {/* Cart */}
            {saleCart.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-purple-300/60 text-sm font-semibold">Cart</p>
                {saleCart.map((c) => (
                  <div key={c.itemId} className="p-3 rounded-xl bg-white/5 border border-purple-500/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-sm font-medium text-white truncate">{c.name}</p>
                      <button onClick={() => removeFromCart(c.itemId)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all">
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Qty controls */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateCartQty(c.itemId, c.qty - 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 transition-all border border-purple-500/20 text-purple-200 text-lg font-bold">
                          -
                        </button>
                        <input type="number" value={c.qty} min="1"
                          onChange={(e) => updateCartQty(c.itemId, parseInt(e.target.value) || 1)}
                          className="w-12 px-1 py-1.5 rounded-lg bg-white/10 border border-purple-500/20 text-center text-sm text-white outline-none focus:border-purple-400" />
                        <button onClick={() => updateCartQty(c.itemId, c.qty + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 transition-all border border-purple-500/20 text-purple-200 text-lg font-bold">
                          +
                        </button>
                      </div>
                      {/* Price input */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-purple-300/40">@</span>
                        <input type="number" value={c.price} step="0.01" min="0"
                          onChange={(e) => updateCartPrice(c.itemId, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 rounded-lg bg-white/10 border border-purple-500/20 text-right text-sm text-white outline-none focus:border-purple-400" />
                      </div>
                      {/* Line total */}
                      <p className="ml-auto text-sm font-bold text-emerald-400">{formatCurrency(c.price * c.qty)}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-purple-300/60 text-sm font-semibold">{taxEnabled ? "Subtotal" : "Total"}</p>
                  <p className={cn("font-black", taxEnabled ? "text-lg text-purple-200" : "text-2xl text-emerald-400")}>{formatCurrency(cartTotal)}</p>
                </div>
                {/* Tax toggle */}
                <div className="flex items-center justify-between px-3 py-2">
                  <button onClick={() => setTaxEnabled(!taxEnabled)}
                    className={cn("px-4 py-2 rounded-full text-sm font-semibold transition-all",
                      taxEnabled
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                        : "bg-white/5 text-purple-300/50 border border-purple-500/20 hover:bg-white/10"
                    )}>
                    {taxEnabled ? "Tax ON" : "Add Tax"}
                  </button>
                  {taxEnabled && (
                    <div className="text-right">
                      <p className="text-xs text-purple-300/50">Tax ({taxRate}%)</p>
                      <p className="text-base font-bold text-purple-200">{formatCurrency(taxAmount)}</p>
                    </div>
                  )}
                </div>
                {taxEnabled && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-purple-500/10">
                    <p className="text-purple-300/60 text-sm font-semibold">Total with Tax</p>
                    <p className="text-2xl font-black text-emerald-400">{formatCurrency(cartTotalWithTax)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-3">
            <button onClick={() => goTo("sale-summary")} disabled={saleCart.length === 0}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xl font-bold transition-all disabled:opacity-30 flex items-center justify-center gap-2">
              Review Order
            </button>
          </div>
        </ScreenWrap>

        {/* ──── MAKE A SALE: Order Summary ──── */}
        <ScreenWrap id="sale-summary">
          <BackBtn onPress={() => goBack("sale-items")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-4">
            <p className="text-center text-purple-300/60 text-base">Order Summary</p>

            {/* Customer & sales person */}
            <div className="w-full bg-white/5 rounded-xl p-4 border border-purple-500/10 space-y-1">
              {customer && <p className="text-lg text-white font-semibold">{customer}</p>}
              {salesPerson && <p className="text-sm text-purple-300/50">Sales person: {salesPerson}</p>}
            </div>

            {/* Line items */}
            <div className="w-full bg-white/5 rounded-xl border border-purple-500/10 divide-y divide-purple-500/10">
              {saleCart.map((c) => (
                <div key={c.itemId} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    <p className="text-xs text-purple-300/50">{c.qty} &times; {formatCurrency(c.price)}</p>
                  </div>
                  <p className="text-sm font-bold text-white ml-4">{formatCurrency(c.price * c.qty)}</p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="w-full bg-white/5 rounded-xl p-4 border border-purple-500/10 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-purple-300/60">Subtotal</p>
                <p className="text-base font-semibold text-white">{formatCurrency(cartTotal)}</p>
              </div>
              {taxEnabled && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-purple-300/60">Tax ({taxRate}%)</p>
                  <p className="text-base font-semibold text-white">{formatCurrency(taxAmount)}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-purple-500/10">
                <p className="text-lg font-bold text-white">Total</p>
                <p className="text-3xl font-black text-emerald-400">{formatCurrency(cartTotalWithTax)}</p>
              </div>
            </div>
          </div>

          {/* Bottom buttons */}
          <div className="p-3 space-y-2">
            <button onClick={() => goBack("sale-items")}
              className="w-full py-3 rounded-xl bg-white/5 border border-purple-500/20 hover:bg-white/10 active:scale-95 text-base font-semibold text-purple-200 transition-all">
              Edit Order
            </button>
            <button onClick={submitCreateInvoice} disabled={saleCreatingInvoice}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xl font-bold transition-all disabled:opacity-30 flex items-center justify-center gap-2">
              {saleCreatingInvoice ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm & Create Invoice"}
            </button>
          </div>
        </ScreenWrap>

        {/* ──── MAKE A SALE: Payment Method ──── */}
        <ScreenWrap id="sale-payment">
          <BackBtn onPress={() => goBack(salePaymentSource === "previous-sales" ? "previous-sales" : salePaymentSource === "sale-summary" ? "sale-summary" : "sale-start")} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            <p className="text-purple-300/60 text-xl font-semibold">Payment Method</p>
            {/* Invoice summary */}
            <div className="w-full max-w-sm bg-white/5 rounded-xl p-4 border border-purple-500/10 text-center space-y-1">
              {invoice && <p className="text-sm text-purple-300/50">Invoice #{invoice}</p>}
              {customer && <p className="text-base text-white font-medium">{customer}</p>}
              <p className="text-4xl font-black text-emerald-400">{fmtAmt(amount)}</p>
            </div>
            <div className="w-full max-w-sm space-y-3">
              <button onClick={() => { setSalePaymentMethod("cash"); setAmountPaid(amount); goTo("sale-cash-paid"); }}
                className="w-full py-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.97] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/30 border border-emerald-500/20">
                <Banknote className="w-7 h-7" />
                <span className="text-xl font-bold">Cash</span>
              </button>
              <button onClick={() => { setSalePaymentMethod("zelle"); submitSaleNonCash("zelle"); }}
                className="w-full py-5 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 active:scale-[0.97] transition-all flex items-center justify-center gap-3 shadow-xl shadow-violet-900/30 border border-violet-500/20">
                <Smartphone className="w-7 h-7" />
                <span className="text-xl font-bold">Zelle</span>
              </button>
              <button onClick={() => { setSalePaymentMethod("credit_card"); initStripePayment(); }}
                disabled={stripeProcessing}
                className="w-full py-5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.97] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/30 border border-blue-500/20 disabled:opacity-50">
                {stripeProcessing ? <Loader2 className="w-7 h-7 animate-spin" /> : <CreditCard className="w-7 h-7" />}
                <span className="text-xl font-bold">Credit Card</span>
              </button>
            </div>
          </div>
        </ScreenWrap>

        {/* ──── MAKE A SALE: Cash — Amount Paid ──── */}
        <ScreenWrap id="sale-cash-paid">
          <BackBtn onPress={() => goBack("sale-payment")} />
          <p className="text-center text-purple-300/60 text-base mt-4">Cash — Amount Paid</p>
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-2">
            <p className="text-purple-300/40 text-sm">Invoice: {fmtAmt(amount)}</p>
            <p className="text-5xl font-black tabular-nums text-white">{fmtAmt(amountPaid)}</p>
            {parseAmt(amountPaid) >= parseAmt(amount) && changeDue() > 0 && (
              <div className="mt-2 px-6 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <p className="text-emerald-400 text-2xl font-black tabular-nums">Change: {formatCurrency(changeDue())}</p>
              </div>
            )}
          </div>
          <Numpad onNext={() => goTo("sale-cash-split")} nextDisabled={parseAmt(amountPaid) < parseAmt(amount)}
            nextLabel={parseAmt(amountPaid) < parseAmt(amount) ? "Insufficient" : "Next"}
            nextColor="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700" />
        </ScreenWrap>

        {/* ──── MAKE A SALE: Cash — Split ──── */}
        <ScreenWrap id="sale-cash-split">
          <BackBtn onPress={() => goBack("sale-cash-paid")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-2 space-y-3">
            <p className="text-center text-purple-300/60 text-base">Cash — Register / Deposit Split</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-xl p-3 text-center border border-purple-500/10">
                <p className="text-xs text-purple-300/40">Paid</p>
                <p className="text-xl font-bold text-white">{fmtAmt(amountPaid)}</p>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
                <p className="text-xs text-emerald-300/60">Change</p>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(changeDue())}</p>
              </div>
            </div>
            <div className="w-full text-left p-4 rounded-xl border-2 border-purple-400 bg-white/5">
              <p className="text-xs text-purple-300/50">To Deposit (use numpad below)</p>
              <p className="text-2xl font-bold tabular-nums">{fmtAmt(toDeposit)}</p>
            </div>
            <div className={cn("p-4 rounded-xl border", splitRegister() < 0 ? "bg-red-500/5 border-red-500/20" : "bg-white/[0.03] border-purple-500/10")}>
              <p className="text-xs text-purple-300/50">{splitRegister() < 0 ? "From Register (change)" : "To Register (auto)"}</p>
              <p className={cn("text-2xl font-bold tabular-nums", splitRegister() < 0 ? "text-red-400" : "text-purple-300")}>
                {splitRegister() < 0 ? `-${formatCurrency(Math.abs(splitRegister()))}` : formatCurrency(splitRegister())}
              </p>
            </div>
            {changeDue() > 0 && (
              <div>
                <label className="block text-xs text-purple-300/50 mb-1.5">Change from?</label>
                <SourceToggle value={changeSource} onChange={setChangeSource} />
              </div>
            )}
          </div>
          <Numpad onNext={submitSaleCash} nextLabel="Record Sale" nextDisabled={parseAmt(toDeposit) > parseAmt(amountPaid)}
            nextColor="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700" />
        </ScreenWrap>

        {/* ──── MAKE A SALE: Stripe — Method Choice ──── */}
        <ScreenWrap id="sale-stripe">
          <BackBtn onPress={() => goBack("sale-payment")} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            <p className="text-purple-300/60 text-xl font-semibold">Credit Card Payment</p>
            <div className="w-full max-w-sm bg-white/5 rounded-xl p-4 border border-purple-500/10 text-center space-y-1">
              {invoice && <p className="text-sm text-purple-300/50">Invoice #{invoice}</p>}
              {customer && <p className="text-base text-white font-medium">{customer}</p>}
              <p className="text-4xl font-black text-blue-400">{fmtAmt(amount)}</p>
            </div>
            {stripeError && (
              <div className="w-full max-w-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{stripeError}</p>
              </div>
            )}
            <div className="w-full max-w-sm space-y-3">
              <button onClick={() => { setStripeError(""); goTo("sale-stripe-card"); }}
                className="w-full py-5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.97] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/30 border border-blue-500/20">
                <CreditCard className="w-7 h-7" />
                <span className="text-xl font-bold">Enter Card</span>
              </button>
              <button onClick={() => { setStripeError(""); goTo("sale-stripe-reader"); setTimeout(discoverReaders, 300); }}
                className="w-full py-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.97] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/30 border border-indigo-500/20">
                <Smartphone className="w-7 h-7" />
                <span className="text-xl font-bold">Use Reader</span>
              </button>
            </div>
          </div>
        </ScreenWrap>

        {/* sale-stripe-card is rendered as a fixed modal below, outside ScreenWrap */}

        {/* ──── MAKE A SALE: Stripe — Terminal Reader ──── */}
        <ScreenWrap id="sale-stripe-reader">
          <BackBtn onPress={() => { terminalRef.current?.disconnectReader(); terminalRef.current = null; goBack("sale-stripe"); }} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            <p className="text-purple-300/60 text-xl font-semibold">Card Reader</p>
            <div className="w-full max-w-sm bg-white/5 rounded-xl p-4 border border-purple-500/10 text-center">
              <p className="text-3xl font-black text-indigo-400">{fmtAmt(amount)}</p>
            </div>
            {stripeReaderStatus && (
              <div className="w-full max-w-sm bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  {stripeProcessing && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
                  <p className="text-indigo-300 text-base">{stripeReaderStatus}</p>
                </div>
              </div>
            )}
            {stripeError && (
              <div className="w-full max-w-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{stripeError}</p>
              </div>
            )}
            {!stripeProcessing && !stripeReaderStatus && (
              <button onClick={discoverReaders}
                className="w-full max-w-sm py-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.97] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/30 border border-indigo-500/20 text-xl font-bold">
                <Smartphone className="w-7 h-7" />
                Discover Readers
              </button>
            )}
            {stripeError && (
              <button onClick={() => { setStripeError(""); setStripeReaderStatus(""); discoverReaders(); }}
                className="w-full max-w-sm py-4 rounded-2xl bg-white/5 border border-purple-500/20 hover:bg-white/10 active:scale-95 text-base font-medium transition-all text-purple-200">
                Retry
              </button>
            )}
          </div>
        </ScreenWrap>

        {/* ──── MAKE A SALE: Success ──── */}
        <ScreenWrap id="sale-success"><SuccessScreen changeAmt={successChange} invoiceId={qboInvoiceId} /></ScreenWrap>

        {/* ──── EXPENSE: Amount ──── */}
        <ScreenWrap id="expense-amount">
          <BackBtn onPress={goHome} />
          <p className="text-center text-purple-300/60 text-base mt-4">Log Expense — Amount</p>
          <AmountDisplay value={amount} color="text-orange-400" />
          <Numpad onNext={() => goTo("expense-details")} nextDisabled={parseAmt(amount) <= 0}
            nextColor="bg-orange-600 hover:bg-orange-500 active:bg-orange-700" />
        </ScreenWrap>

        {/* ──── EXPENSE: Details ──── */}
        <ScreenWrap id="expense-details">
          <BackBtn onPress={() => goBack("expense-amount")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-5">
            <p className="text-center text-purple-300/60 text-base">Log Expense — Details</p>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-purple-500/10">
              <p className="text-3xl font-bold text-orange-400">{fmtAmt(amount)}</p>
            </div>
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Description</label>
              <BigInput placeholder="What was it for?" value={description} onChange={setDescription} />
            </div>
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Category</label>
              <Pills options={["General","Labor","Supplies","Fuel","Food","Equipment","Maintenance","Utilities","Other"]} value={category} onChange={setCategory} />
            </div>

            {/* Out of Pocket toggle */}
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Payment Type</label>
              <div className="flex gap-2">
                <button onClick={() => setOutOfPocket(false)}
                  className={cn("flex-1 py-3 rounded-xl text-base font-semibold transition-all active:scale-95 border",
                    !outOfPocket ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/25" : "bg-white/5 border-purple-500/20 text-purple-300/60 hover:bg-white/10"
                  )}>
                  Business Funds
                </button>
                <button onClick={() => setOutOfPocket(true)}
                  className={cn("flex-1 py-3 rounded-xl text-base font-semibold transition-all active:scale-95 border",
                    outOfPocket ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/25" : "bg-white/5 border-purple-500/20 text-purple-300/60 hover:bg-white/10"
                  )}>
                  Out of Pocket
                </button>
              </div>
            </div>

            {!outOfPocket ? (
              <div>
                <label className="block text-sm text-purple-300/50 mb-1.5">Deduct From</label>
                <SourceToggle value={source} onChange={setSource} />
              </div>
            ) : (
              <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/15 space-y-3">
                <p className="text-sm text-amber-300/80">Out-of-pocket expenses won&apos;t deduct from register or deposit.</p>
                <div>
                  <label className="block text-sm text-purple-300/50 mb-1.5">Reimburse From</label>
                  <SourceToggle value={reimbursedSource} onChange={setReimbursedSource} />
                  <p className="text-xs text-purple-300/30 mt-1">When reimbursed, funds will come from this source</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Paid By</label>
              <BigInput placeholder="Who paid?" value={paidBy} onChange={setPaidBy} />
            </div>

            {/* Receipt upload */}
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Receipt (optional)</label>
              <input type="file" accept="image/*,.pdf" ref={receiptInputRef} className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
              {receiptFile ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-purple-500/10">
                  <Camera className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="flex-1 text-sm text-white truncate">{receiptFile.name}</p>
                  <button onClick={() => { setReceiptFile(null); if (receiptInputRef.current) receiptInputRef.current.value = ""; }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all">
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ) : (
                <button onClick={() => receiptInputRef.current?.click()}
                  className="w-full py-4 rounded-xl bg-white/5 border border-dashed border-purple-500/20 hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-purple-300/50">
                  <Camera className="w-5 h-5" />
                  <span className="text-base font-medium">Upload Receipt</span>
                </button>
              )}
            </div>
          </div>
          <div className="p-3">
            <button onClick={submitExpense} disabled={!description || saving}
              className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-95 text-xl font-bold transition-all disabled:opacity-30 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Record Expense"}
            </button>
          </div>
        </ScreenWrap>

        <ScreenWrap id="expense-success"><SuccessScreen /></ScreenWrap>

        {/* ──── CASH OUT: Amount ──── */}
        <ScreenWrap id="cashout-amount">
          <BackBtn onPress={goHome} />
          <p className="text-center text-purple-300/60 text-base mt-4">Cash Out — Amount</p>
          <AmountDisplay value={amount} color="text-red-400" />
          <Numpad onNext={() => goTo("cashout-details")} nextDisabled={parseAmt(amount) <= 0}
            nextColor="bg-red-600 hover:bg-red-500 active:bg-red-700" />
        </ScreenWrap>

        {/* ──── CASH OUT: Details ──── */}
        <ScreenWrap id="cashout-details">
          <BackBtn onPress={() => goBack("cashout-amount")} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-5">
            <p className="text-center text-purple-300/60 text-base">Cash Out — Details</p>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-purple-500/10">
              <p className="text-3xl font-bold text-red-400">{fmtAmt(amount)}</p>
            </div>
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Category</label>
              <Pills options={["Labor","Payout","Food","Supplies","Equipment","Fuel","Maintenance","Other"]} value={category} onChange={setCategory} />
            </div>
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Source</label>
              <SourceToggle value={source} onChange={setSource} />
            </div>
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Customer (optional)</label>
              <BigInput placeholder="Customer name" value={customer} onChange={setCustomer} />
            </div>
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Invoice # (optional)</label>
              <BigInput placeholder="Invoice number" value={invoice} onChange={setInvoice} />
            </div>
            <div>
              <label className="block text-sm text-purple-300/50 mb-1.5">Notes (optional)</label>
              <textarea placeholder="Any notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full px-4 py-4 rounded-xl bg-white/5 border border-purple-500/20 text-xl text-white placeholder-purple-300/30 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition resize-none" />
            </div>
          </div>
          <div className="p-3">
            <button onClick={submitCashOut} disabled={saving}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-xl font-bold transition-all disabled:opacity-30 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Record Cash Out"}
            </button>
          </div>
        </ScreenWrap>

        <ScreenWrap id="cashout-success"><SuccessScreen /></ScreenWrap>

        {/* ──── TRANSFER: Amount + Direction ──── */}
        <ScreenWrap id="transfer-amount">
          <BackBtn onPress={goHome} />
          <div className="flex-1 overflow-y-auto px-4 pt-14 pb-4 space-y-4">
            <p className="text-center text-purple-300/60 text-base">Transfer Between Accounts</p>

            {/* Direction toggle */}
            <div className="flex gap-2 px-2">
              <button onClick={() => setTransferDirection("to-deposit")}
                className={cn("flex-1 py-3 rounded-xl text-base font-bold transition-all border",
                  transferDirection === "to-deposit"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-white/5 border-purple-500/20 text-purple-300/60 hover:bg-white/10"
                )}>
                Register → Deposit
              </button>
              <button onClick={() => setTransferDirection("to-register")}
                className={cn("flex-1 py-3 rounded-xl text-base font-bold transition-all border",
                  transferDirection === "to-register"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-white/5 border-purple-500/20 text-purple-300/60 hover:bg-white/10"
                )}>
                Deposit → Register
              </button>
            </div>

            {/* Amount display */}
            <div className="text-center py-2">
              <p className="text-xs text-purple-300/40 mb-1">Amount to Transfer</p>
              <p className={cn("text-5xl font-black tracking-tight", parseAmt(amount) > 0 ? "text-blue-400" : "text-purple-300/30")}>{fmtAmt(amount)}</p>
            </div>
          </div>
          <Numpad onNext={submitTransfer} nextDisabled={parseAmt(amount) <= 0 || saving} nextLabel={saving ? "Saving..." : "Transfer"} nextColor="bg-blue-600 hover:bg-blue-500 active:bg-blue-700" />
        </ScreenWrap>

        <ScreenWrap id="transfer-success"><SuccessScreen /></ScreenWrap>

        {/* ──── PREVIOUS SALES ──── */}
        <ScreenWrap id="previous-sales">
          <BackBtn onPress={goHome} />
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-4">
            <p className="text-center text-purple-300/60 text-xl font-semibold">Previous Sales</p>

            {/* Date filter pills */}
            <div className="flex gap-2 flex-wrap">
              {([["Today", "today"], ["This Week", "week"], ["This Month", "month"], ["All", "all"]] as const).map(([label, val]) => (
                <button key={val} onClick={() => handleRecentFilterChange({ dateRange: val })}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    recentFilter.dateRange === val
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-purple-300/50 border border-purple-500/20 hover:bg-white/10"
                  )}>{label}</button>
              ))}
            </div>

            {/* Status filter pills */}
            <div className="flex gap-2">
              {([["All", "all"], ["Unpaid", "unpaid"], ["Paid", "paid"]] as const).map(([label, val]) => (
                <button key={val} onClick={() => handleRecentFilterChange({ status: val })}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    recentFilter.status === val
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-purple-300/50 border border-purple-500/20 hover:bg-white/10"
                  )}>{label}</button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/40" />
              <input type="text" placeholder="Search by customer or invoice #..."
                value={recentFilter.search}
                onChange={(e) => handleRecentSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-purple-500/20 text-sm text-white placeholder-purple-300/30 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition" />
            </div>

            {/* Invoice list */}
            {recentLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>
            ) : recentInvoices.length > 0 ? (
              <div className="space-y-2">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="p-3 rounded-xl bg-white/5 border border-purple-500/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">#{inv.docNumber}</p>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            inv.status === "paid" ? "bg-emerald-500/15 text-emerald-400"
                              : inv.status === "partial" ? "bg-amber-500/15 text-amber-400"
                              : "bg-red-500/15 text-red-400"
                          )}>
                            {inv.status === "paid" ? "Paid" : inv.status === "partial" ? "Partial" : "Unpaid"}
                          </span>
                        </div>
                        <p className="text-xs text-purple-300/50 truncate">{inv.customerName}</p>
                        {inv.txnDate && <p className="text-[10px] text-purple-300/30">{inv.txnDate}</p>}
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-base font-bold text-emerald-400">{formatCurrency(inv.totalAmt)}</p>
                        {inv.balance > 0 && inv.balance !== inv.totalAmt && (
                          <p className="text-[10px] text-amber-300/60">Bal: {formatCurrency(inv.balance)}</p>
                        )}
                      </div>
                    </div>
                    {/* Action row */}
                    <div className="flex gap-2">
                      <button onClick={() => window.open(`/api/quickbooks/invoices/${inv.id}/pdf`, "_blank")}
                        className="flex-1 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 border border-indigo-500/20">
                        <FileText className="w-3.5 h-3.5 text-indigo-300" />
                        <span className="text-xs font-medium text-indigo-200">View Invoice</span>
                      </button>
                      {inv.status !== "paid" && (
                        <button onClick={() => {
                          selectQboInvoice(inv);
                          setSalePaymentSource("previous-sales");
                          goTo("sale-payment");
                        }}
                          className="flex-1 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 border border-emerald-500/20">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
                          <span className="text-xs font-medium text-emerald-200">Collect Payment</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-purple-300/30 py-6 text-sm">No sales found</p>
            )}
          </div>
        </ScreenWrap>
      </div>

      {/* ──── Stripe Card Entry Modal (rendered outside ScreenWrap system) ──── */}
      {screen === "sale-stripe-card" && (
        <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 flex flex-col">
          <button onClick={() => { setStripeCardReady(false); goBack("sale-stripe"); }}
            className="absolute top-3 left-3 z-20 w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-purple-500/20 active:bg-white/10 active:scale-95 transition-all">
            <ArrowLeft className="w-6 h-6 text-purple-200" />
          </button>
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            <p className="text-purple-300/60 text-xl font-semibold">Enter Card Details</p>
            <div className="w-full max-w-sm bg-white/5 rounded-xl p-4 border border-purple-500/10 text-center">
              <p className="text-3xl font-black text-blue-400">{fmtAmt(amount)}</p>
            </div>
            <div className="w-full max-w-sm">
              <div ref={cardMountRef} className="w-full px-4 py-5 rounded-xl bg-slate-800 border-2 border-purple-400/40 min-h-[60px]" />
            </div>
            {stripeError && (
              <div className="w-full max-w-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{stripeError}</p>
              </div>
            )}
            <button onClick={handleStripeCardSubmit}
              disabled={stripeProcessing || !stripeCardReady}
              className="w-full max-w-sm py-5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.97] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/30 border border-blue-500/20 disabled:opacity-50 text-xl font-bold">
              {stripeProcessing ? <><Loader2 className="w-6 h-6 animate-spin" /> Processing...</> : !stripeCardReady ? <><Loader2 className="w-6 h-6 animate-spin" /> Loading...</> : "Pay Now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
