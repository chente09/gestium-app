import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusquedaFormComponent } from './busqueda-form.component';

describe('BusquedaFormComponent', () => {
  let component: BusquedaFormComponent;
  let fixture: ComponentFixture<BusquedaFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusquedaFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BusquedaFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
