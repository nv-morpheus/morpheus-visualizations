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
# UBUNTU_VERSION=$(sed -n 's/^VERSION_ID="\([0-9\.]*\)"$/\1/p' /etc/os-release)
UBUNTU_VERSION="20.04"

echo "Pulling ubuntu${UBUNTU_VERSION} containers..."

docker pull ghcr.io/rapidsai/node:22.06.00-devel-node16.15.1-cuda11.6.2-ubuntu${UBUNTU_VERSION}-packages

docker run --rm -w /opt/rapids -v "$PWD/rapidsai:/out" \
    ghcr.io/rapidsai/node:22.06.00-devel-node16.15.1-cuda11.6.2-ubuntu${UBUNTU_VERSION}-packages \
    sh -c "cp \
           rapidsai-core-22.6.0.tgz \
           rapidsai-cuda-22.6.0.tgz \
           rapidsai-rmm-22.6.0.tgz \
           rapidsai-cudf-22.6.0.tgz \
           rapidsai-cuml-22.6.0.tgz \
           rapidsai-cugraph-22.6.0.tgz \
           /out/"

# chown $(id -u):$(id -g) rapidsai/*.tgz

# cd - 2>&1>/dev/null
