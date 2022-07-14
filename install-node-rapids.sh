#!/usr/bin/env -S bash -Eeo pipefail

if [ -d "node_modules/@rapidsai" ]; then exit 0; fi

rm -rf rapidsai
mkdir -p rapidsai

docker pull ghcr.io/rapidsai/node:22.06.00-devel-node16.15.1-cuda11.6.2-ubuntu20.04-packages

docker run --rm -w /opt/rapids -v "$PWD/rapidsai:/out" \
    ghcr.io/rapidsai/node:22.06.00-devel-node16.15.1-cuda11.6.2-ubuntu20.04-packages \
    sh -c "cp \
           rapidsai-core-22.6.0.tgz \
           rapidsai-cuda-22.6.0.tgz \
           rapidsai-rmm-22.6.0.tgz \
           rapidsai-cudf-22.6.0.tgz \
           rapidsai-cuml-22.6.0.tgz \
           rapidsai-cugraph-22.6.0.tgz \
           /out/"

# chown $(id -u):$(id -g) rapidsai/*.tgz

cd - 2>&1>/dev/null
