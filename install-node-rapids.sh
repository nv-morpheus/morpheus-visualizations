#!/usr/bin/env bash

set -Eeo pipefail

if [ -d "node_modules/@rapidsai" ]; then
    echo "Node modules are already built. Exiting setup..."
    exit 0
fi

# Remove existing directories
rm -rf rapidsai
mkdir -p rapidsai

# Determine your ubuntu version
UBUNTU_VERSION=$(sed -n 's/^VERSION_ID="\([0-9\.]*\)"$/\1/p' /etc/os-release)

echo "Pulling ubuntu${UBUNTU_VERSION} containers..."

docker pull ghcr.io/rapidsai/node:22.02.00-devel-node16.13.2-cuda11.6.0-ubuntu${UBUNTU_VERSION}-packages

docker run --rm -w /opt/rapids -v "$PWD/rapidsai:/out" \
    ghcr.io/rapidsai/node:22.02.00-devel-node16.13.2-cuda11.6.0-ubuntu${UBUNTU_VERSION}-packages \
    bash -c "cp \
             rapidsai-core-0.0.1.tgz \
             rapidsai-cuda-0.0.1.tgz \
             rapidsai-rmm-0.0.1.tgz \
             rapidsai-cudf-0.0.1.tgz \
             rapidsai-cuml-0.0.1.tgz \
             rapidsai-cugraph-0.0.1.tgz \
             /out/"

chown $(id -u):$(id -g) rapidsai/*.tgz

# cd - 2>&1>/dev/null
