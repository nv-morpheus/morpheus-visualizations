# syntax=docker/dockerfile:1.3-labs

ARG CUDA_VERSION=11.6.2
ARG NODE_VERSION=16.15.1
ARG RAPIDS_VERSION=22.06.00
ARG LINUX_VERSION=ubuntu20.04
ARG REPOSITORY=ghcr.io/rapidsai/node

ARG FROM_IMAGE=${REPOSITORY}:${RAPIDS_VERSION}-runtime-node${NODE_VERSION}-cuda${CUDA_VERSION}-${LINUX_VERSION}-base
ARG DEVEL_IMAGE=${REPOSITORY}:${RAPIDS_VERSION}-devel-node${NODE_VERSION}-cuda${CUDA_VERSION}-${LINUX_VERSION}-main
ARG BUILD_IMAGE=${REPOSITORY}:${RAPIDS_VERSION}-devel-node${NODE_VERSION}-cuda${CUDA_VERSION}-${LINUX_VERSION}-packages

FROM ${BUILD_IMAGE} as build
FROM ${DEVEL_IMAGE} as devel

USER root

WORKDIR /home/node

SHELL ["/bin/bash", "-Eeox", "pipefail", "-c"]

RUN apt update \
 && DEBIAN_FRONTEND=noninteractive \
    apt install -y --no-install-recommends \
        dpkg fakeroot

ARG RAPIDSAI_GPU_ARCH

RUN --mount=type=bind,source=.,target=/home/node,rw \
    --mount=type=bind,from=build,source=/opt/rapids,target=/home/node/rapidsai \
<<EOF

RAPIDSAI_GPU_ARCH=${RAPIDSAI_GPU_ARCH} \
RAPIDSAI_SKIP_DOWNLOAD=0 \
npm i --verbose

MAKE_DEB=1 \
npm run make

cp -ar /home/node/out/make/deb/x64/nvidia-morpheus-graphvis_1.0.0_amd64.deb \
       /opt/nvidia-morpheus-graphvis.deb

EOF

FROM ${FROM_IMAGE}

SHELL ["/bin/bash", "-Eeox", "pipefail", "-c"]

USER root

RUN --mount=type=bind,from=devel,source=/opt/nvidia-morpheus-graphvis.deb,target=/opt/nvidia-morpheus-graphvis.deb \
<<EOF

apt update

DEBIAN_FRONTEND=noninteractive \
apt install -y --no-install-recommends \
    /opt/nvidia-morpheus-graphvis.deb

apt autoremove -y

apt clean

rm -rf \
    /tmp/* \
    /var/tmp/* \
    /var/cache/apt/* \
    /var/lib/apt/lists/*

EOF

USER node

ENV NODE_OPTIONS=

WORKDIR /home/node

CMD ["nvidia-morpheus-graphvis"]
