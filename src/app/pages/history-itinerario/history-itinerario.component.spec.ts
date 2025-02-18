import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoryItinerarioComponent } from './history-itinerario.component';

describe('HistoryItinerarioComponent', () => {
  let component: HistoryItinerarioComponent;
  let fixture: ComponentFixture<HistoryItinerarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryItinerarioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoryItinerarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
