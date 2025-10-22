import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { areaGuard } from './area.guard';

describe('areaGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => areaGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
