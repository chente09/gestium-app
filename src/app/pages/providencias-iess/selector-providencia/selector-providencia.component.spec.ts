import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectorProvidenciaComponent } from './selector-providencia.component';

describe('SelectorProvidenciaComponent', () => {
  let component: SelectorProvidenciaComponent;
  let fixture: ComponentFixture<SelectorProvidenciaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectorProvidenciaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectorProvidenciaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
