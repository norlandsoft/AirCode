#!/usr/bin/env bash
# 从 AirOne pnpm store 链接运行时依赖（网络安装不稳定时的离线方案）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
AIRONE_PNPM="${AIRONE_PNPM:-/opt/AirOne/node_modules/.pnpm}"
AC="$ROOT"
mkdir -p "$AC/node_modules"/{@aircode,@anthropic-ai,@hono,@types,@vitejs}

link() {
  local dest="$1" src="$2"
  if [[ ! -e "$src" ]]; then
    echo "MISS $src" >&2
    return 1
  fi
  mkdir -p "$(dirname "$dest")"
  ln -sfn "$src" "$dest"
  echo "LINK $dest"
}

link "$AC/node_modules/hono" "$AIRONE_PNPM/hono@4.12.30/node_modules/hono"
link "$AC/node_modules/react" "$AIRONE_PNPM/react@18.3.1/node_modules/react"
link "$AC/node_modules/react-dom" "$AIRONE_PNPM/react-dom@18.3.1_react@18.3.1/node_modules/react-dom"
link "$AC/node_modules/typescript" "$AIRONE_PNPM/typescript@5.9.3/node_modules/typescript"
link "$AC/node_modules/tsx" "$AIRONE_PNPM/tsx@4.23.1/node_modules/tsx"
link "$AC/node_modules/vite" "$AIRONE_PNPM/vite@8.1.3_@types+node@22.20.1_esbuild@0.28.1_jiti@2.7.0_less@4.6.7_tsx@4.23.1_yaml@2.9.0/node_modules/vite"
link "$AC/node_modules/@vitejs/plugin-react" "$AIRONE_PNPM/@vitejs+plugin-react@6.0.3_vite@8.1.3_@types+node@22.20.1_esbuild@0.28.1_jiti@2.7.0_less@4.6.7_tsx@4.23.1_yaml@2.9.0_/node_modules/@vitejs/plugin-react"
link "$AC/node_modules/@types/node" "$AIRONE_PNPM/@types+node@22.20.1/node_modules/@types/node"
link "$AC/node_modules/@types/react" "$AIRONE_PNPM/@types+react@18.3.31/node_modules/@types/react"
link "$AC/node_modules/@types/react-dom" "$AIRONE_PNPM/@types+react-dom@18.3.7_@types+react@18.3.31/node_modules/@types/react-dom"
link "$AC/node_modules/@hono/node-server" "$AIRONE_PNPM/@hono+node-server@1.19.14_hono@4.12.30/node_modules/@hono/node-server"
link "$AC/node_modules/scheduler" "$AIRONE_PNPM/scheduler@0.23.2/node_modules/scheduler"
link "$AC/node_modules/csstype" "$AIRONE_PNPM/csstype@3.2.3/node_modules/csstype"
link "$AC/node_modules/esbuild" "$AIRONE_PNPM/esbuild@0.28.1/node_modules/esbuild"
link "$AC/node_modules/rollup" "$AIRONE_PNPM/rollup@4.62.2/node_modules/rollup"
link "$AC/node_modules/postcss" "$AIRONE_PNPM/postcss@8.5.16/node_modules/postcss"
link "$AC/node_modules/nanoid" "$AIRONE_PNPM/nanoid@3.3.15/node_modules/nanoid"
link "$AC/node_modules/picocolors" "$AIRONE_PNPM/picocolors@1.1.1/node_modules/picocolors"
link "$AC/node_modules/source-map-js" "$AIRONE_PNPM/source-map-js@1.2.1/node_modules/source-map-js"
link "$AC/node_modules/fdir" "$AIRONE_PNPM/fdir@6.5.0_picomatch@4.0.4/node_modules/fdir"
link "$AC/node_modules/picomatch" "$AIRONE_PNPM/picomatch@4.0.4/node_modules/picomatch"
link "$AC/node_modules/tinyglobby" "$AIRONE_PNPM/tinyglobby@0.2.17/node_modules/tinyglobby"

# 本地 tarball 解压产物（需已存在 vendor/tgz）
for name in dotenv concurrently; do
  if [[ -d "$AC/node_modules/$name" ]]; then
    echo "KEEP $name"
  fi
done
if [[ -d "$AC/node_modules/@anthropic-ai/claude-agent-sdk" ]]; then
  echo "KEEP @anthropic-ai/claude-agent-sdk"
fi

link "$AC/node_modules/@aircode/shared" "$AC/packages/shared"
link "$AC/node_modules/@aircode/runtime" "$AC/packages/runtime"

echo "done"
