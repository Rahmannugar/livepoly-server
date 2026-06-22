import { ObservabilityService } from './observability.service';

describe('ObservabilityService', () => {
  it('ignores and ends the current transaction through its handle', () => {
    const ignore = jest.fn();
    const end = jest.fn();
    const getTransaction = jest.fn().mockReturnValue({ ignore, end });
    const service = new ObservabilityService();

    Reflect.set(service, 'newrelic', { getTransaction });

    service.ignoreCurrentTransaction();

    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(ignore).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('does nothing when observability is disabled', () => {
    const service = new ObservabilityService();

    expect(() => service.ignoreCurrentTransaction()).not.toThrow();
  });
});
