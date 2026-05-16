import { Injectable } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';
import type { CreateJobInput } from './job.types';

export type JobStartResult =
  | { status: 'started' }
  | { status: 'missing' }
  | { status: 'queued' }
  | { status: 'processing' }
  | { status: 'completed' }
  | { status: 'failed' }
  | { status: 'exhausted' };

@Injectable()
export class JobsService {
  constructor(private readonly jobsRepository: JobsRepository) {}

  createOrGet(input: CreateJobInput) {
    return this.jobsRepository.createOrGet(input);
  }

  async start(jobId: string): Promise<JobStartResult> {
    const startedJob = await this.jobsRepository.start(jobId);

    if (startedJob) {
      return { status: 'started' };
    }

    const job = await this.jobsRepository.findById(jobId);

    if (!job) {
      return { status: 'missing' };
    }

    if (job.status === 'failed' && job.attempts >= job.maxAttempts) {
      return { status: 'exhausted' };
    }

    return { status: job.status };
  }

  complete(jobId: string) {
    return this.jobsRepository.complete(jobId);
  }

  fail(jobId: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown job error';

    return this.jobsRepository.fail(jobId, message.slice(0, 2000));
  }
}
