import { setDefaultAllocator } from '@rapidsai/cuda';
import {
  DeviceBuffer,
  PoolMemoryResource,
  getCurrentDeviceResource,
  setCurrentDeviceResource,
} from '@rapidsai/rmm';

export function initializeDefaultPoolMemoryResource(
  initialPoolSize = 2 * (1024 ** 3), // 2GiB
  maximumPoolSize = 4 * (1024 ** 3), // 4GiB
) {
  const mr = new PoolMemoryResource(
    getCurrentDeviceResource(),
    initialPoolSize,
    maximumPoolSize,
  );
  setCurrentDeviceResource(mr);
  setDefaultAllocator((byteLength) => new DeviceBuffer(byteLength, mr));
}
