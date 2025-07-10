import { TestBed } from '@angular/core/testing';

import { AreaActivitiesService } from './area-activities.service';

describe('AreaActivitiesService', () => {
  let service: AreaActivitiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AreaActivitiesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
