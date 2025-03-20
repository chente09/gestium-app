import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItinerarioComponent } from './itinerario.component';

describe('ItinerarioComponent', () => {
  let component: ItinerarioComponent;
  let fixture: ComponentFixture<ItinerarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItinerarioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItinerarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
