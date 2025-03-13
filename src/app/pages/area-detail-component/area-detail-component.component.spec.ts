import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AreaDetailComponentComponent } from './area-detail-component.component';

describe('AreaDetailComponentComponent', () => {
  let component: AreaDetailComponentComponent;
  let fixture: ComponentFixture<AreaDetailComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AreaDetailComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AreaDetailComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
