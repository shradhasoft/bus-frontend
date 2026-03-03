const getControlUrl = () => {
  const explicit = String(process.env.E2E_SEED_CONTROL_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const baseUrl = String(process.env.E2E_BASE_URL || "").trim();
  if (!baseUrl) return "";
  return baseUrl.replace(/\/+$/, "");
};

const postWithToken = async (url: string, token: string, body?: unknown) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-admin-token": token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Seed control request failed (${response.status}): ${text}`);
  }
};

async function globalSetup() {
  const controlUrl = getControlUrl();
  const token = String(process.env.TEST_ADMIN_TOKEN || "").trim();
  if (!controlUrl || !token) return;

  await postWithToken(`${controlUrl}/internal/test/reset`, token);
  await postWithToken(`${controlUrl}/internal/test/seed`, token, {
    callbackRequestCount: 5,
  });
}

export default globalSetup;

