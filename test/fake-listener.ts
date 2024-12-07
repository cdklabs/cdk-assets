import { IPublishProgressListener, EventType, IPublishProgress } from '../lib/progress';

export class FakeListener implements IPublishProgressListener {
  public readonly types = new Array<EventType>();
  public readonly messages = new Array<string>();

  constructor(private readonly doAbort = false) {}

  public onPublishEvent(type: EventType, event: IPublishProgress): void {
    this.types.push(type);
    this.messages.push(event.message);

    if (this.doAbort) {
      event.abort();
    }
  }
}
