export default () => {
  const url = new URL(window.location.href);
  const port = ref<string | null>(null);
  const baseUrl = computed(() => (port.value ? `${url.protocol}//${url.hostname}:${port.value}` : null));

  const handleServerReady = (e: Event) => {
    port.value = (e as CustomEvent).detail.port;
  };

  onMounted(() => {
    const storedPort = localStorage.getItem("server-port");
    if (storedPort) {
      port.value = storedPort;
    }
    window.addEventListener("server-ready", handleServerReady);
  });

  onUnmounted(() => {
    window.removeEventListener("server-ready", handleServerReady);
  });

  return { port, baseUrl };
};
