```shell
# Run the following to perform a clean build (Can be skipped for incremental builds)
rm -rf node_modules

# Install all dependencies
yarn

# Build the demo
MAKE_DEB=1 \
MAKE_RPM=1 \
MAKE_ZIP=1 \
MAKE_APPIMAGE=1 \
yarn make
```
