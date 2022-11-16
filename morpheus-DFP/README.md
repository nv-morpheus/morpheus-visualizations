# Morpheus Digital Finger Print Visualization Tool

Visualize user access events and detect anomalies based on the anomaly score, while also tracking down anomalous patterns amongst all users.

![homepage](./public/home1.png)

## Getting Started

This dashboard is meant to be run after running the Morpheus Digital Fingerprinting(DFP) pipeline on Azure and Duo log data to generate input files for visualizing.

You can find more information in the [DFP Production Pipeline Example Readme](https://github.com/nv-morpheus/Morpheus/tree/branch-22.11/examples/digital_fingerprinting/visualization).

The application backend compute is powered by the NODE RAPIDS (specifically @rapidsai/cudf) packages. More information about node-rapids can be found [here](https://github.com/rapidsai/node).

## Requirements

### CUDA/GPU requirements

- CUDA 11.0+
- NVIDIA driver 450.80.02+
- Pascal architecture or better (Compute Capability >=6.0)

### OS requirements

- Server: See the [Rapids System Requirements section](https://rapids.ai/start.html#requirements) for information on compatible OS.
- Client: Chrome(tested on v107) / firefox(tested on v106) / safari (tested on v15)

### RAPIDS

- @rapidsai/cudf ([dev](https://github.com/rapidsai/node/tree/main/modules/cudf), [npm](https://www.npmjs.com/package/@rapidsai/cudf))

## Installation

### 1. Install the dependencies

```bash
yarn && yarn build
```

### 2. Set the data directory

Set the `dataset_path` environment variable to set the data directory where the input data DFP visualization application will be periodically saved.

If `dataset_path` is not set, the default data directory will be [./public/data](./public/data).

### 3. Running the app

```bash
yarn start
```

Go to [http://localhost:3000](http://localhost:3000)

## Configuration file (`.env`)

This file controls configuration options for the application on startup. The configuration options starting with the `NEXT_PUBLIC_` prefix can also be controlled once the app has started, via the settings panel on the left of the dashboard, this merely provides a way to preset them to be set as defaults on startup.

This file also contains default values for individual event attributes for both azure and duo, which if present in this file, will be used to scale the attribute values for each event. If a value for a particular attribute is not found in the `.env` file, the `min` and `max` values of the current dataset in memory will be used to scale the individual event selected.

## Usage Guide

The visualization app can be used as a 'real-time' dashboard to monitor for anomalous events, or as research tool for finding patterns in historical anomalous behaviors.

The visualization app has four main components:

- **Area chart** of total network events vs anomalous events
- **Hexagon grid** of events grouped by user
- **Event details** menu on the right
- **Settings menu** on the left

There is also a bottom status bar with information on last action, update time, and more.

Note: **hovering over** the circle **i** icons will give you information about the given view or setting.

### Area Chart

The chart represents the full view of the loaded dataset. The white area represents **all** network traffic by event count. The orange represents anomalous events, as set by the lower bound of _anomalous color threshold_ in the settings menu.

### Hexagon Grid

The hexagon grid represents users, with anomalous events binned, colored, and sorted by row and time. The grid view can be reformatted in the settings menu. The **most recent** time stamp starts on the left. Note, the hexagon grid and area chart axis are not synced. You can navigate the hex grid by **left click and dragging** the view. You can **zoom in and out** with the mouse wheel. To reset the view **double click** anywhere on the grid.

The **color of the hexagon** is based on the **maximum anomalous event** if there are multiple events binned in the hexagon. Clicking on a a colored hexagon opens the details menu. If the menu is open, click anywhere or the menu's X to close. A selected hexagon will have a black border. Hexagons colored **gray** signify no recorded events.

Using **SHIFT + left click and dragging** will tilt into a **3D view** of the hexagons, with the height representing the number of events. To reset the view back into 2D, **double click** anywhere on the grid. Note, it is possible to **right click and drag** to tilt into a 3D view, but is not recommended.

### Event Details

Clicking on a colored hexagon will open the event details menu. Clicking the X or anywhere on the grid will close it. **Selected Events** is a dropdown of all the anomalous events binned within the hexagon, ordered from most anomalous to least. Note, the number of events can vary depending on _Time Bin Per Hexagon_ in the settings menu.

The **Anomalous Scale** is the hexagon color legend for **scaled** anomaly scores between 0 and 1. This does not re-scale the score, just the range and threshold of the color pallette. The scale will effect what the area chart counts as an anomalous event.

The **Attributes** list consists of the **overall scaled anomaly score**, which the hexagon colors are based, and its unscaled raw score. Below, are the individual **contributing attributes** scaled score and raw score. The scaled **mean score** is calculated based on the values of the loaded dataset. A larger difference between the mean and attribute anomaly scores will be an indicator contributing to its overall anomaly score.

### Settings Menu

These are settings that alter the behavior and views of the app. Note, settings above the break line must be **applied** by clicking the **apply button**. Those below the break line will update in real time.

The settings menu can be opened by clicking the **menu icon** in the upper left side of the app. Clicking the X will close it.

The **Current Dataset** drop down menu shows the currently selected dataset located in the data in the data directory specified by the `.env` file. Clicking the _reload icon_ will update the drop down if new files have been added.

The **Sort By..** drop down menu shows the different ways to order the users, based on the anomalous events.

The **Anomalous Color Threshold** range slider sets at what anomaly score the hexagons are colored, and the range between what is considered slightly anomalous to critical.

The **Visible Users (Rows)** slider sets how many user ID rows to show from top to bottom, based on the currently selected sort option. The max is automatically set based on the number of user IDs in the dataset to the limit set in the `.env` file. If the hexagon interaction performance is slow, decreasing the visible users can help.

The **Time Bin Per Hexagon** slider sets how many seconds of time each hexagon represents. A larger value will show less columns of hexagons and have more events per hexagon, while a smaller value will show more hexagons. If the hexagon interaction performance is slow, increasing the time bin can help.

The **Look Back Time** represents the amount of time shown in seconds, starting from the most recent time in the dataset. The maximum value is based on the full time of the dataset. Setting the look back time to anything less than the maximum will generate a status warning noting that the full dataset has not been visualized. If the hexagon interaction performance is slow, decreasing the look back time can help.

The **Update Frequency** represents the time in seconds between checking for a newer dataset file in the data directory. If a new file is present, the app will **automatically load that file** and visualize it. Note, the 'newness' of the dataset is based on the preconfigured **timestamp based name** of the file.

The **Live Updates** toggles if the app will **automatically update** the loaded dataset based on the update frequency setting. Note, if a user has selected an older dataset file and live updates is on, the **latest dataset will load** even if they are still interacting with the file.

The **Hexagon Height** range slider scales the heights of the hexagons when in a **3D view**.

The **3d Perspective Lock** toggles if the user is able to rotate and pan while in a **3D view**.

## Troubleshooting and FAQ

1. `Error: libnvrtc.so.11.\*: cannot open shared object file: No such file or directory`.

This could be a result of incorrect or missing cudatoolkit in your environment, especially if running outside a RAPIDS docker container. Make sure the install the [latest cudatoolkit](https://developer.nvidia.com/cuda-downloads).

2. `Out of Memory` error.

This could happen if the dataset being loaded is larger the GPU memory available. One way to avoid this would be to break down the azure and duo logs into smaller files, covering a smaller amount of time, pause `live updates` and go through each file individually by selecting it from the `Current Dataset` dropdown in the left settings panel.

3. `yarn: command not found` error

Make sure to install the [latest `yarn` package](https://classic.yarnpkg.com/lang/en/docs/install/#debian-stable) in your environment.

## Screenshots

> Configuration Panel
> ![homepage2](./public/home2.png)

> Event onClick info panel
> ![homepage3](./public/home3.png)

## Development

To start a development server, execute the following commands:

```bash
yarn dev
```

## Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
