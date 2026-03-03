const getControlUrl = () => {
  const explicit = String(process.env.E2E_SEED_CONTROL_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const baseUrl = String(process.env.E2E_BASE_URL || "").trim();
  if (!baseUrl) return "";
  return baseUrl.replace(/\/+$/, "");
};

async function globalTeardown() {
  const controlUrl = getControlUrl();
  const token = String(process.env.TEST_ADMIN_TOKEN || "").trim();
  if (!controlUrl || !token) return;

  await fetch(`${controlUrl}/internal/test/reset`, {
    method: "POST",
    headers: {
      "x-test-admin-token": token,
    },
  });
}

export default globalTeardown;

