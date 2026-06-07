<template>
  <div class="loading c">
    <div class="logoWrap c" :class="{ leave: isLeaving }">
      <div class="imgWrap">
        <div class="logoAura" :class="{ stop: !isPulse }" />
        <div class="logoSvg" :class="{ stop: !isPulse }">
          <div class="logoSvgInner" v-html="logoSvg" />
        </div>
      </div>
      <span class="title" :class="{ show: isTitleShow }">Toonflow</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import logoRaw from "@/../../assets/logo.svg?raw";

const router = useRouter();

const isPulse = ref(true);
const isTitleShow = ref(false);
const isLeaving = ref(false);

const logoSvg = logoRaw.replace(/<path /g, '<path pathLength="1" ');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await sleep(1200);

  isPulse.value = false;
  await sleep(700);

  isTitleShow.value = true;
  await sleep(900);

  isLeaving.value = true;
  await sleep(600);

  router.push("/workbench");
}

const isElectron = !!(window as any).process?.versions?.electron;
if (!isElectron) {
  run();
} else {
  const handler = () => {
    window.removeEventListener("server-ready", handler);
    run();
  };
  window.addEventListener("server-ready", handler);
  // 处理竞态：事件可能在监听器注册前就已触发
  if ((window as any).__serverReady) {
    window.removeEventListener("server-ready", handler);
    run();
  }
}
</script>

<style lang="scss" scoped>
.loading {
  width: 100%;
  height: 100vh;
  background: #fff;

  .logoWrap {
    display: flex;
    flex-direction: row;
    align-items: center;
    transition:
      transform 0.55s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.55s ease;

    &.leave {
      transform: scale(1.12);
      opacity: 0;
    }

    .imgWrap {
      position: relative;
      width: 20vw;
      height: 20vw;
      display: flex;
      align-items: center;
      justify-content: center;

      .gradientDefs {
        position: absolute;
        width: 0;
        height: 0;
      }

      .logoAura {
        position: absolute;
        inset: 6%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0, 0, 0, 0.16) 0%, transparent 70%);
        animation: auraPulse 2.4s ease-in-out infinite;
        filter: blur(2px);

        &.stop {
          animation: auraOut 0.45s ease forwards;
        }
      }

      .logoSvg {
        position: relative;
        width: 60%;
        height: 60%;
        z-index: 1;

        .logoSvgInner {
          width: 100%;
          height: 100%;
          line-height: 0;
        }

        :deep(svg) {
          display: block;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        :deep(path) {
          stroke: #000;
          stroke-width: 14;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: #000;
          fill-opacity: 0;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.18));
          animation: logoDraw 2.8s ease-in-out infinite;
        }

        :deep(path:nth-of-type(2)) {
          animation-delay: 0.35s;
        }

        &.stop {
          animation: none;

          :deep(path) {
            animation: logoReveal 0.5s ease forwards;
            stroke-dashoffset: 0;
            fill-opacity: 1;
          }
        }
      }
    }

    .title {
      font-size: 64px;
      font-weight: bold;
      color: #000000;
      letter-spacing: 2px;
      white-space: nowrap;
      width: 0;
      overflow: hidden;
      opacity: 0;
      margin-left: 0;
      transition:
        width 0.6s ease,
        opacity 0.6s ease,
        margin-left 0.6s ease;
      &.show {
        width: 350px;
        opacity: 1;
        margin-left: -50px;
      }
    }
  }
}

@keyframes logoDraw {
  0% {
    stroke-dashoffset: 1;
  }
  40% {
    stroke-dashoffset: 0;
  }
  60% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: -1;
  }
}

@keyframes logoReveal {
  from {
    stroke-dashoffset: 0;
    fill-opacity: 0;
  }
  to {
    stroke-dashoffset: 0;
    fill-opacity: 1;
  }
}

@keyframes auraPulse {
  0%,
  100% {
    transform: scale(0.88);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.85;
  }
}

@keyframes auraOut {
  to {
    opacity: 0;
    transform: scale(0.82);
  }
}
</style>
