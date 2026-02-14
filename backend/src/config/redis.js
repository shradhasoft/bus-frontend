const REDIS_URL = process.env.REDIS_URL || "";

const state = {
  initialized: false,
  ready: false,
  lastError: null,
};

let commandClient = null;
let publisherClient = null;
let subscriberClient = null;
let initPromise = null;
let createClientFn = null;

const attachClientEvents = (client, name) => {
  client.on("error", (error) => {
    state.ready = false;
    state.lastError = error?.message || String(error);
    console.error(`[Redis:${name}] error`, error);
  });

  client.on("ready", () => {
    state.ready = true;
    state.lastError = null;
    console.log(`[Redis:${name}] ready`);
  });
};

const loadRedisModule = async () => {
  if (createClientFn) return createClientFn;
  const mod = await import("redis");
  createClientFn = mod.createClient;
  return createClientFn;
};

const createNamedClient = (createClient, name) => {
  const client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 150, 2000),
    },
  });
  attachClientEvents(client, name);
  return client;
};

export const initRedis = async () => {
  if (state.initialized) return state.ready;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    state.initialized = true;

    if (!REDIS_URL) {
      state.ready = false;
      state.lastError = "REDIS_URL is missing";
      console.warn("[Redis] REDIS_URL is not configured");
      return false;
    }

    try {
      const createClient = await loadRedisModule();
      commandClient = createNamedClient(createClient, "command");
      publisherClient = createNamedClient(createClient, "publisher");
      subscriberClient = createNamedClient(createClient, "subscriber");

      await Promise.all([
        commandClient.connect(),
        publisherClient.connect(),
        subscriberClient.connect(),
      ]);

      await commandClient.ping();
      state.ready = true;
      state.lastError = null;
      console.log("[Redis] Connected successfully");
      return true;
    } catch (error) {
      state.ready = false;
      state.lastError = error?.message || String(error);
      if (String(state.lastError).includes("Cannot find package 'redis'")) {
        console.warn(
          "[Redis] 'redis' package is not installed. Install dependencies to enable Redis features.",
        );
      } else {
        console.error("[Redis] Initialization failed:", error);
      }
      return false;
    }
  })();

  return initPromise;
};

export const isRedisReady = () =>
  Boolean(state.ready && commandClient && publisherClient && subscriberClient);

export const getRedisStatus = () => ({
  configured: Boolean(REDIS_URL),
  initialized: state.initialized,
  ready: state.ready,
  lastError: state.lastError,
});

export const getRedisCommandClient = () => commandClient;
export const getRedisPublisherClient = () => publisherClient;
export const getRedisSubscriberClient = () => subscriberClient;
