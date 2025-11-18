import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProvidenciaIessComponent } from './providencia-iess.component';

describe('ProvidenciaIessComponent', () => {
  let component: ProvidenciaIessComponent;
  let fixture: ComponentFixture<ProvidenciaIessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProvidenciaIessComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProvidenciaIessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
