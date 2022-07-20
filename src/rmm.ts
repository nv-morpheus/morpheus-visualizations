import {setDefaultAllocator} from '@rapidsai/cuda';
import {
  DeviceBuffer,
  getCurrentDeviceResource,
  PoolMemoryResource,
  setCurrentDeviceResource,
} from '@rapidsai/rmm';

export function initializeDefaultPoolMemoryResource(initialPoolSize?: number,
                                                    maximumPoolSize?: number) {
  const mr = new PoolMemoryResource(
    getCurrentDeviceResource(),
    initialPoolSize,
    maximumPoolSize,
  );
  setCurrentDeviceResource(mr);
  setDefaultAllocator((byteLength) => new DeviceBuffer(byteLength, mr));
}
