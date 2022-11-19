# syntax=docker/dockerfile:1.3-labs

ARG CUDA_VERSION=11
ARG NODE_VERSION=16.15.1
ARG RAPIDS_VERSION=22.6.2
ARG LINUX_VERSION=ubuntu20.04
ARG REPOSITORY=ghcr.io/rapidsai/node

ARG FROM_IMAGE=${REPOSITORY}:${RAPIDS_VERSION}-runtime-node${NODE_VERSION}-cuda${CUDA_VERSION}-${LINUX_VERSION}-base
ARG DEVEL_IMAGE=${REPOSITORY}:${RAPIDS_VERSION}-devel-node${NODE_VERSION}-cuda${CUDA_VERSION}-${LINUX_VERSION}-main

FROM ${DEVEL_IMAGE} as devel

USER root

SHELL ["/bin/bash", "-Eeox", "pipefail", "-c"]

RUN apt update \
 && DEBIAN_FRONTEND=noninteractive \
    apt install -y --no-install-recommends \
        dpkg fakeroot \
 && apt autoremove -y \
 && apt clean \
 && rm -rf \
    /tmp/* \
    /var/tmp/* \
    /var/cache/apt/* \
    /var/lib/apt/lists/*

ARG CUDA_VERSION
ARG RAPIDSAI_GPU_ARCH

RUN --mount=type=bind,source=.,target=/opt/rapids/node,rw \
<<EOF

RAPIDSAI_GPU_ARCH=${RAPIDSAI_GPU_ARCH} \
RAPIDSAI_CUDA_VERSION=${CUDA_VERSION} \
RAPIDSAI_SKIP_DOWNLOAD=0 \
yarn

MAKE_DEB=1 yarn make

cp -ar out/make/deb/x64/nvidia-morpheus-graphvis_*.deb \
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
