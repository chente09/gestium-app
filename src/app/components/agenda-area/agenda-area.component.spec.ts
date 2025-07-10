import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgendaAreaComponent } from './agenda-area.component';

describe('AgendaAreaComponent', () => {
  let component: AgendaAreaComponent;
  let fixture: ComponentFixture<AgendaAreaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendaAreaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgendaAreaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
