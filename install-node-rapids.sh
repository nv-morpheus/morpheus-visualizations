#!/usr/bin/env -S bash -Eeo pipefail

if [ -d "rapidsai/node_modules/@rapidsai" ]; then exit 0; fi

rm -rf rapidsai
mkdir -p rapidsai

docker pull ghcr.io/rapidsai/node:22.02.00-devel-node16.13.2-cuda11.6.0-ubuntu20.04-packages

docker run --rm -w /opt/rapids -v "$PWD/rapidsai:/out" \
    ghcr.io/rapidsai/node:22.02.00-devel-node16.13.2-cuda11.6.0-ubuntu20.04-packages \
    bash -c "cp \
             wrtc-0.4.7-dev.tgz \
             rapidsai-core-*.tgz \
             rapidsai-cuda-*.tgz \
             rapidsai-glfw-*.tgz \
             rapidsai-webgl-*.tgz \
             rapidsai-rmm-*.tgz \
             rapidsai-cudf-*.tgz \
             rapidsai-sql-*.tgz \
             rapidsai-cuml-*.tgz \
             rapidsai-cugraph-*.tgz \
             rapidsai-cuspatial-*.tgz \
             rapidsai-io-*.tgz \
             rapidsai-deck.gl-*.tgz \
             rapidsai-jsdom-*.tgz \
             /out/"

chown $(id -u):$(id -g) rapidsai/*.tgz

cd rapidsai

npm init --yes
npm install \
    --save --prod \
    --legacy-peer-deps --force \
    --omit dev --omit peer --omit optional \
    *.tgz

rm package.json *.tgz

cd - 2>&1>/dev/null
