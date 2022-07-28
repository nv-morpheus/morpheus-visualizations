FROM ghcr.io/rapidsai/node:22.06.00-devel-node16.15.1-cuda11.6.2-ubuntu20.04-main as base

USER root

# Install libgtx-3-0
RUN apt update &&\
    apt install -y libgtk-3-0 &&\
    apt autoremove -y && apt clean &&\
    rm -rf \
      /tmp/* \
      /var/tmp/* \
      /var/cache/apt/* \
      /var/lib/apt/lists/*

USER rapids


# Create a new stage to build/run inside the container
FROM base as build

# Copy the source over
COPY --chown=rapids:rapids ./ /opt/rapids/viz

# Everything will be out of /opt/rapids/viz
WORKDIR /opt/rapids/viz

# USER root

# Clean and build the GUI
RUN rm -rf node_modules && yarn bootstrap

# USER rapids

CMD ["yarn start"]
