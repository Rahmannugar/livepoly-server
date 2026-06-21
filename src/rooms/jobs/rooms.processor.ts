import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { QUEUES, ROOM_JOBS } from '../../infra/queue/queue.constants';
import { RoomsExpiryService } from '../services/rooms-expiry.service';

@Processor(QUEUES.rooms)
export class RoomsProcessor extends WorkerHost {
  constructor(
    private readonly roomsExpiryService: RoomsExpiryService,
    private readonly observabilityService: ObservabilityService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === ROOM_JOBS.expireWaitingRooms) {
      await this.roomsExpiryService.expireWaitingRooms();
      return;
    }

    this.observabilityService.recordEvent('RoomsUnknownJobReceived', {
      jobId: job.id,
      jobName: job.name,
    });
    this.observabilityService.recordMetric('Custom/Rooms/UnknownJobReceived');
  }
}
