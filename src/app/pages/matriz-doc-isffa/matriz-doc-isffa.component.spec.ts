import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatrizDocIsffaComponent } from './matriz-doc-isffa.component';

describe('MatrizDocIsffaComponent', () => {
  let component: MatrizDocIsffaComponent;
  let fixture: ComponentFixture<MatrizDocIsffaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatrizDocIsffaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatrizDocIsffaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
