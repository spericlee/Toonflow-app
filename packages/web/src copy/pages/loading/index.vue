<template>
  <div class="c">
    {{ prot }}
  </div>
</template>

<script setup lang="ts">
export const usePort = () => {
  // hash 路由下 search 在 # 后，需要从 hash 中解析
  const hash = location.hash; // "#/?port=xxxx"
  const search = hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
  const params = new URLSearchParams(search);
  const port = ref<string | null>(
    params.get("port") || localStorage.getItem("port")
  );
  if (port.value) {
    localStorage.setItem("port", port.value);
  }
  return { port };
};
watch(port, (newVal) => {
  console.log("port changed:", newVal);
});
</script>

<style lang="scss" scoped></style>
