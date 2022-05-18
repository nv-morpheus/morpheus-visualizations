#!/usr/bin/env -S bash -Eeo pipefail

if [ -d "rapidsai/node_modules/@rapidsai" ]; then exit 0; fi

rm -rf rapidsai
mkdir -p rapidsai

docker pull ghcr.io/rapidsai/node:22.02.00-devel-node16.13.2-cuda11.6.0-ubuntu20.04-packages

docker run --rm -w /opt/rapids -v "$PWD/rapidsai:/out" \
    ghcr.io/rapidsai/node:22.02.00-devel-node16.13.2-cuda11.6.0-ubuntu20.04-packages \
    bash -c "cp \
             rapidsai-core-0.0.1.tgz \
             rapidsai-cuda-0.0.1.tgz \
             rapidsai-rmm-0.0.1.tgz \
             rapidsai-cudf-0.0.1.tgz \
             rapidsai-cuml-0.0.1.tgz \
             rapidsai-cugraph-0.0.1.tgz \
             /out/"

chown $(id -u):$(id -g) rapidsai/*.tgz

cd rapidsai

npm init --yes
npm install --save --save-exact cmake-js@6.0.0
npm install \
    --save --prod \
    --legacy-peer-deps --force \
    --omit dev --omit peer --omit optional \
    *.tgz

rm package.json *.tgz

cd - 2>&1>/dev/null
