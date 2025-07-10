import { TestBed } from '@angular/core/testing';

import { UserAreaService } from './user-area.service';

describe('UserAreaService', () => {
  let service: UserAreaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserAreaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
