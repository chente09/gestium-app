import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultadosTablaComponent } from './resultados-tabla.component';

describe('ResultadosTablaComponent', () => {
  let component: ResultadosTablaComponent;
  let fixture: ComponentFixture<ResultadosTablaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultadosTablaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultadosTablaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
