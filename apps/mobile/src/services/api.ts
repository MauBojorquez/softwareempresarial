import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

async function getToken() {
  return SecureStore.getItemAsync("auth_token");
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync("auth_token", token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync("auth_token");
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string }>("/api/auth/mobile/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await saveToken(data.token);
  return data;
}

export async function register(name: string, email: string, password: string, company: string) {
  const data = await apiFetch<{ token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, company }),
  });
  await saveToken(data.token);
  return data;
}

export async function fetchDashboardMetrics() {
  return apiFetch<{
    revenue: number;
    revenueChange: number;
    pipeline: number;
    pipelineChange: number;
    employees: number;
    employeesChange: number;
    conversion: number;
    conversionChange: number;
  }>("/api/metrics/dashboard");
}

export async function fetchFinanceMetrics() {
  return apiFetch<{
    income: number;
    incomeChange: number;
    expenses: number;
    expensesChange: number;
    netProfit: number;
    netProfitChange: number;
    cashFlow: number;
    cashFlowChange: number;
  }>("/api/metrics/finance");
}

export async function fetchSalesMetrics() {
  return apiFetch<{
    pipeline: number;
    activeDeals: number;
    conversionRate: number;
    avgDealSize: number;
  }>("/api/metrics/sales");
}

export async function fetchReports() {
  return apiFetch<Array<{
    id: string;
    title: string;
    createdAt: string;
    summary: string;
    status: string;
  }>>("/api/reports");
}

export async function generateReport() {
  return apiFetch<{ id: string }>("/api/reports/generate", { method: "POST" });
}
