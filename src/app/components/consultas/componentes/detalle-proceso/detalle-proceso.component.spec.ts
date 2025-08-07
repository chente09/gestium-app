import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleProcesoComponent } from './detalle-proceso.component';

describe('DetalleProcesoComponent', () => {
  let component: DetalleProcesoComponent;
  let fixture: ComponentFixture<DetalleProcesoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleProcesoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleProcesoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
