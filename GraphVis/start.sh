# Run these in the "morpheus" repo dir

# # Start triton:
# docker run --rm -it --gpus=1 \
#   -p8000:8000 \
#   -p8001:8001 \
#   -p8002:8002 \
#   -v $PWD/models:/models \
#   nvcr.io/nvidia/tritonserver:21.12-py3 tritonserver \
#     --model-repository=/models/triton-model-repo \
#     --exit-on-error=false \
#     --model-control-mode=explicit \
#     --load-model sid-minibert-onnx

# # Start Morpheus:
# docker run --rm -it --gpus=1 --net=host -v $PWD:/workspace \
#   morpheus-demo:latest morpheus \
#     --log_level=DEBUG run \
#     --num_threads=8 \
#     --edge_buffer_size=4 \
#     --pipeline_batch_size=1024 \
#     --model_max_batch_size=32 \
#     pipeline-nlp \
#     --model_seq_length=256 from-file \
#     --filename=data/pcap_dump.jsonlines deserialize preprocess \
#     --vocab_hash_file=./data/bert-base-uncased-hash.txt \
#     --truncation=True \
#     --do_lower_case=True \
#     --add_special_tokens=False inf-triton \
#     --model_name=sid-minibert-onnx \
#     --server_url=localhost:8001 \
#     --force_convert_inputs=True monitor \
#     --description "Inference Rate" \
#     --unit inf \
#     add-class gen-viz

# https://github.com/mdemoret-nv/Morpheus/tree/mdd_demo-socket/examples/sid_visualization

docker run --rm -it \
    --runtime=nvidia \
    -v $PWD/models:/models \
    -e NVIDIA_VISIBLE_DEVICES=1 \
    -p 8000:8000 -p 8001:8001 -p 8002:8002 \
    nvcr.io/nvidia/tritonserver:22.02-py3 \
        tritonserver \
            --exit-on-error=false \
            --model-control-mode=explicit \
            --load-model sid-minibert-onnx \
            --model-repository=/models/triton-model-repo

DOCKER_IMAGE_TAG=latest ./docker/run_container_dev.sh
pip install -e . && pip install websockets
python examples/sid_visualization/run.py \
  --num_threads=1 \
  --max_batch_size=4096 \
  --input_file=./examples/data/sid_visualization/group1-benign-2nodes-v2.jsonlines \
  --input_file=./examples/data/sid_visualization/group2-benign-50nodes.jsonlines \
  --input_file=./examples/data/sid_visualization/group3-si-50nodes.jsonlines \
  --input_file=./examples/data/sid_visualization/group4-benign-49nodes.jsonlines \
 &> /dev/null

# Run the 20.04 container with the drivers and video capabilities
docker run --rm -ti -v "$PWD:/work" -w /work -v "/tmp/.X11-unix:/tmp/.X11-unix" \
    --gpus=all -e DISPLAY="${DISPLAY}" -e NVIDIA_DRIVER_CAPABILITIES="graphics,video,compute,utility" \
    --cap-add=SYS_PTRACE --security-opt=seccomp=unconfined \
    -e DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/$UID/bus}" \
    -v /run/dbus/system_bus_socket:/run/dbus/system_bus_socket \
    ghcr.io/rapidsai/node:22.6.2-devel-node16.15.1-cuda11-ubuntu20.04-main bash

docker run --rm -ti -v "$PWD:/opt/rapids/viz" -w /opt/rapids/viz  \
    --gpus=all -e DISPLAY="${DISPLAY}" -e NVIDIA_DRIVER_CAPABILITIES="graphics,video,compute,utility" \
    --cap-add=SYS_PTRACE --security-opt=seccomp=unconfined --security-opt=apparmor=unconfined \
    -e DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/$UID/bus}" \
    -v "/tmp/.X11-unix:/tmp/.X11-unix" -v "/run/dbus/system_bus_socket:/run/dbus/system_bus_socket" -v "${XDG_RUNTIME_DIR:-/run/user/$UID}:${XDG_RUNTIME_DIR:-/run/user/$UID}" \
    sid-viz:base bash

# ===In the container===
# Need to install libgtk-3-0 first
sudo apt update
sudo apt install -y libgtk-3-0

# To clean the build
rm -rf node_modules

# Install the dependencies
yarn

# Launch the GUI in dev mode
yarn start

# Package the GUI into distributables
MAKE_DEB=1 \
MAKE_RPM=1 \
MAKE_ZIP=1 \
MAKE_APPIMAGE=1 \
yarn make
