import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DmdProcOrdinarioComponent } from './dmd-proc-ordinario.component';

describe('DmdProcOrdinarioComponent', () => {
  let component: DmdProcOrdinarioComponent;
  let fixture: ComponentFixture<DmdProcOrdinarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DmdProcOrdinarioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DmdProcOrdinarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
